import logging
import os
from io import BytesIO
from pathlib import Path

from colorfield.fields import ColorField
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.db import models, transaction
from django.utils.text import slugify
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)


def _decode_for_processing(image_field, decode_hint):
    """Open an image field and return a decoded, EXIF-corrected PIL image.

    ``decode_hint`` is the largest width we will actually need. Passing it to
    ``draft()`` lets libjpeg decode the file at (close to) that size instead
    of decoding the full-resolution original and then throwing most of the
    pixels away — for a 4000px-wide phone photo being reduced to 1000px this
    is the difference between a slow save and a fast one.
    """
    try:
        image_field.seek(0)
    except Exception:
        # Some storage backends hand back a non-seekable stream; Image.open
        # will still work as long as we haven't consumed it already.
        pass

    with Image.open(image_field) as source:
        source.draft("RGB", (decode_hint, decode_hint))

        # exif_transpose always returns a new image, so it is safe to use the
        # result after the source's file handle closes.
        image = ImageOps.exif_transpose(source)

    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGB")

    return image


def _encode_webp(image, max_width, quality):
    """Downscale a decoded image to ``max_width`` and encode it as WEBP."""
    if image.width > max_width:
        height = max(1, round(image.height * max_width / image.width))
        image = image.resize((max_width, height), Image.Resampling.LANCZOS)

    buffer = BytesIO()
    image.save(
        buffer,
        format="WEBP",
        quality=quality,
        method=4,  # Faster encoding than Pillow's highest effort
        optimize=False,
    )
    return ContentFile(buffer.getvalue())


def compress_image_to_webp(
    image_field,
    *,
    max_width=1200,
    quality=82,
    thumbnail_max_width=None,
    thumbnail_quality=85,
):
    """Convert an uploaded image to WEBP in place, optionally building a thumbnail.

    The upload is decoded exactly once and both outputs are derived from that
    single in-memory copy. Generating the thumbnail as a separate pass meant
    re-reading the freshly written WEBP back off disk and decoding it again —
    twice the CPU per uploaded photo, and a thumbnail that had been through
    two lossy encodes instead of one.

    Returns the thumbnail as a ``ContentFile`` when ``thumbnail_max_width`` is
    given (the caller is responsible for saving it), otherwise ``None``. The
    main image is written back onto ``image_field`` with ``save=False``.
    """
    if not image_field or not image_field.name:
        return None

    # Avoid re-decoding files already converted by this pipeline, unless we
    # still need a thumbnail out of them (the backfill command relies on this)
    # or the WEBP is bigger than this pipeline allows (uploaded as WEBP).
    already_webp = image_field.name.lower().endswith(".webp")
    oversized = already_webp and image_width(image_field) > max_width
    if already_webp and not oversized and not thumbnail_max_width:
        return None

    try:
        decode_hint = max(max_width, thumbnail_max_width or 0)
        image = _decode_for_processing(image_field, decode_hint)

        thumbnail = (
            _encode_webp(image, thumbnail_max_width, thumbnail_quality)
            if thumbnail_max_width
            else None
        )
        main = _encode_webp(image, max_width, quality) if (oversized or not already_webp) else None
        image.close()
    except Exception:
        logger.exception(
            "Image conversion failed for %s", getattr(image_field, "name", "<unknown>")
        )
        return None

    if main is not None:
        stem = Path(image_field.name).stem
        image_field.save(f"{stem}.webp", main, save=False)

    return thumbnail


def image_width(image_field):
    """Pixel width from the file header, without decoding the image."""
    try:
        image_field.seek(0)
    except Exception:
        pass
    try:
        with Image.open(image_field) as im:
            return im.width
    except Exception:
        return 0


# Sizes the storefront actually displays (with room for high-density screens).
PRODUCT_MAIN_MAX_WIDTH = 1000
PRODUCT_THUMB_MAX_WIDTH = 600   # cards show ~180-280 CSS px
CATEGORY_MAX_WIDTH = 450        # circles of up to ~208 CSS px
HERO_MAX_WIDTH = 640            # tiles of 160x240 CSS px


def make_thumbnail_webp(image_field, *, max_width=PRODUCT_THUMB_MAX_WIDTH, quality=78):
    """Build a small WEBP thumbnail from an already-saved image field.

    Returns a ContentFile, or None if it can't be built (missing file,
    decode failure, etc). Caller is responsible for saving it.
    """
    if not image_field or not image_field.name:
        return None

    try:
        image = _decode_for_processing(image_field, max_width)
        thumbnail = _encode_webp(image, max_width, quality)
        image.close()
        return thumbnail
    except Exception:
        logger.exception("Thumbnail generation failed")
        return None


class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, blank=True)
    image = models.ImageField(upload_to="categories/", blank=True, null=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        
        # Category images are only ever displayed as a small circular
        # thumbnail (max ~208px on screen), so 450px covers retina displays
        # with headroom instead of shipping an 800px original every time.
        if self.image:
            compress_image_to_webp(self.image, max_width=CATEGORY_MAX_WIDTH, quality=78)
            
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class ProductTag(models.Model):
    name = models.CharField(max_length=50, unique=True)
    def __str__(self):
        return self.name


class ProductColor(models.Model):
    name = models.CharField(max_length=100, unique=True)
    color = ColorField(default="#FFFFFF")

    class Meta:
        ordering = ["name"]
    def __str__(self):
        return self.name


class Product(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    # PROTECT: deleting a category must not silently delete its products.
    category = models.ForeignKey("Category", on_delete=models.PROTECT)
    description = models.TextField()

    # Hide a product instead of deleting it: it disappears from the shop but
    # keeps its ids, so carts, shared links and past orders keep working.
    is_active = models.BooleanField("Show in shop", default=True, db_index=True)

    shipping_charge = models.DecimalField(max_digits=10, decimal_places=2, default=50.00)
    has_sizes = models.BooleanField(default=True)

    # Package weight/dimensions for a single unit of this product, used to
    # build India Post booking payloads (physical_weight/length/breadth/height).
    # Left blank to fall back to the store-wide INDIAPOST_DEFAULT_* settings.
    weight_grams = models.PositiveIntegerField(blank=True, null=True)
    length_cm = models.PositiveIntegerField(blank=True, null=True)
    breadth_cm = models.PositiveIntegerField(blank=True, null=True)
    height_cm = models.PositiveIntegerField(blank=True, null=True)

    original_price = models.DecimalField(max_digits=10, decimal_places=2)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, editable=False, default=0)

    tags = models.ManyToManyField("ProductTag", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.original_price and self.price:
            if self.original_price > 0:
                discount = ((self.original_price - self.price) / self.original_price) * 100
                self.discount_percentage = round(discount, 2)
            else:
                self.discount_percentage = 0
        else:
            self.discount_percentage = 0
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class ProductImage(models.Model):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="images",
    )
    image = models.ImageField(upload_to="products/")
    # Small variant used anywhere the image is shown as a grid/list tile
    # (homepage cards, cart, checkout) so those views don't have to download
    # the full 800px detail-page image just to render a ~150-300px thumbnail.
    thumbnail = models.ImageField(upload_to="products/thumbs/", blank=True, null=True, editable=False)
    color = models.ForeignKey(
        "ProductColor",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="images",
    )
    class Meta:
        # id is a monotonically increasing auto-PK, so ordering by it is a
        # reliable stand-in for upload order (there's no created_at field on
        # this model). Without this, the API/admin has no guaranteed order at
        # all — it happens to often match insertion order on a small,
        # rarely-updated table, but that's incidental, not guaranteed, and
        # breaks the moment the table's query plan shifts (e.g. after a
        # migration or a bulk UPDATE across every row).
        ordering = ["id"]

    def save(self, *args, **kwargs):
        image_changed = self._state.adding

        if not image_changed and self.pk:
            old_name = (
                type(self).objects
                .filter(pk=self.pk)
                .values_list("image", flat=True)
                .first()
            )
            image_changed = old_name != self.image.name

        if image_changed and self.image:
            # One decode produces both the detail-page image and the grid
            # thumbnail. These used to be two separate passes, the second of
            # which re-opened and re-decoded the WEBP the first had just
            # written to disk.
            thumb = compress_image_to_webp(
                self.image,
                max_width=PRODUCT_MAIN_MAX_WIDTH,
                quality=80,
                thumbnail_max_width=PRODUCT_THUMB_MAX_WIDTH,
                thumbnail_quality=78,
            )
            if thumb is not None:
                stem = Path(self.image.name).stem
                self.thumbnail.save(f"{stem}_thumb.webp", thumb, save=False)

        super().save(*args, **kwargs)


SIZE_CHOICES = (
    ('XS', 'XS'),
    ('S', 'S'),
    ('M', 'M'),
    ('L', 'L'),
    ('XL', 'XL'),
    ('XXL', 'XXL'),
    ('3XL', '3XL'),
    ('4XL', '4XL'),
    ('5XL', '5XL'),
    ('6XL', '6XL'),
    ('0', '0'),
    ('16', '16'),
    ('18', '18'),
    ('20', '20'),
    ('22', '22'),
    ('24', '24'),
    ('26', '26'),
    ('28', '28'),
    ('30', '30'),
    ('32', '32'),
    ('34', '34'),
    ('36', '36'),
    ('38', '38'),
    ('40', '40'),
    ('42', '42'),
    ('44', '44'),
    ('46', '46'),
    ('48', '48'),
    ('50', '50'),
    ('52', '52'),
    ('54', '54'),
    ('55', '55'),
    ('60', '60'),
    ('65', '65'),
    ('70', '70'),
    ('75', '75'),
    ('80', '80'),
    ('85', '85'),
    ('90', '90'),
    ('95', '95'),
    ('100', '100'),
    ('105', '105'),
    ('110', '110'),
)


class ProductVariant(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    color = models.ForeignKey(ProductColor, on_delete=models.CASCADE, related_name="variants")
    size = models.CharField(max_length=5, choices=SIZE_CHOICES)
    stock = models.PositiveIntegerField(default=0)
    reserved_stock = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("product", "color", "size")
        ordering = ["product__name", "color__name", "size"]

    def __str__(self):
        parts = [self.product.name]
        if self.color:
            parts.append(self.color.name)
        if self.size and self.size != "0":
            parts.append(self.size)
        return " — ".join(parts)

    @property
    def available_stock(self):
        return max(0, self.stock - self.reserved_stock)

    @property
    def is_out_of_stock(self):
        return self.available_stock == 0

class HeroImage(models.Model):
    image = models.ImageField(upload_to="hero/")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"Hero Image {self.id}"

    def save(self, *args, **kwargs):
        image_changed = self._state.adding

        if not image_changed and self.pk:
            old_name = (
                type(self).objects
                .filter(pk=self.pk)
                .values_list("image", flat=True)
                .first()
            )
            image_changed = old_name != self.image.name

        # Hero banners were previously stored/served completely unprocessed
        # (raw phone-camera JPEGs up to ~3.6MB) — this was the single
        # biggest contributor to a slow homepage.
        if image_changed and self.image:
            compress_image_to_webp(self.image, max_width=HERO_MAX_WIDTH, quality=78)

        super().save(*args, **kwargs)
        cache.delete("hero_images_api_cache")

    def delete(self, *args, **kwargs):
        super().delete(*args, **kwargs)
        cache.delete("hero_images_api_cache")
