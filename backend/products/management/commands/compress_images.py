from pathlib import Path

from django.core.management.base import BaseCommand

from products.models import (
    CATEGORY_MAX_WIDTH,
    CATEGORY_SMALL_MAX_WIDTH,
    HERO_MAX_WIDTH,
    HERO_SMALL_MAX_WIDTH,
    PRODUCT_MAIN_MAX_WIDTH,
    PRODUCT_SMALL_MAX_WIDTH,
    PRODUCT_THUMB_MAX_WIDTH,
    Category,
    HeroImage,
    ProductImage,
    compress_image_to_webp,
    image_width,
    make_thumbnail_webp,
    save_small_copy,
)


class Command(BaseCommand):
    help = (
        "Backfill: convert raw images to WebP, shrink any image wider than the "
        "storefront displays, and (re)build product thumbnails that are missing "
        "or oversized. Safe to re-run. Original files are left on disk."
    )

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Only report what would change.")

    def handle(self, *args, **options):
        self.dry = options["dry_run"]
        self.changed = 0
        self._fix(HeroImage.objects.all(), "hero", HERO_MAX_WIDTH)
        self._fix(Category.objects.all(), "category", CATEGORY_MAX_WIDTH)
        self._fix(ProductImage.objects.all(), "product image", PRODUCT_MAIN_MAX_WIDTH)
        self._thumbnails()
        self._small_copies(HeroImage, "image", "image_small", HERO_SMALL_MAX_WIDTH)
        self._small_copies(Category, "image", "image_small", CATEGORY_SMALL_MAX_WIDTH)
        self._small_copies(ProductImage, "image", "small", PRODUCT_SMALL_MAX_WIDTH)
        verb = "Would change" if self.dry else "Changed"
        self.stdout.write(self.style.SUCCESS(f"{verb} {self.changed} files."))

    def _needs_work(self, field, max_width):
        if not field or not field.name:
            return False
        try:
            return not field.name.lower().endswith(".webp") or image_width(field) > max_width
        except Exception:
            return False

    def _fix(self, objects, label, max_width):
        for obj in objects:
            if not self._needs_work(obj.image, max_width):
                continue
            self.changed += 1
            old = obj.image.name
            if self.dry:
                self.stdout.write(f"{label} {obj.pk}: {old} ({image_width(obj.image)}px) -> {max_width}px webp")
                continue
            try:
                compress_image_to_webp(obj.image, max_width=max_width, quality=78 if label != "product image" else 80)
                # update_fields keeps the model's own save() from reprocessing it.
                type(obj).objects.filter(pk=obj.pk).update(image=obj.image.name)
                self.stdout.write(self.style.SUCCESS(f"{label} {obj.pk}: {old} -> {obj.image.name}"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Failed {label} {obj.pk}: {e}"))
        if hasattr(objects.model, "_meta") and objects.model is HeroImage and not self.dry:
            from django.core.cache import cache
            cache.delete("hero_images_api_cache")

    def _thumbnails(self):
        for img in ProductImage.objects.all():
            if not img.image or not img.image.name:
                continue
            thumb_ok = img.thumbnail and img.thumbnail.name and image_width(img.thumbnail) <= PRODUCT_THUMB_MAX_WIDTH
            if thumb_ok:
                continue
            self.changed += 1
            if self.dry:
                self.stdout.write(f"thumbnail {img.pk}: {'missing' if not img.thumbnail else img.thumbnail.name} -> {PRODUCT_THUMB_MAX_WIDTH}px")
                continue
            thumb = make_thumbnail_webp(img.image, max_width=PRODUCT_THUMB_MAX_WIDTH, quality=78)
            if thumb is None:
                self.stdout.write(self.style.ERROR(f"Failed thumbnail {img.pk}"))
                continue
            stem = Path(img.image.name).stem
            img.thumbnail.save(f"{stem}_thumb.webp", thumb, save=False)
            ProductImage.objects.filter(pk=img.pk).update(thumbnail=img.thumbnail.name)

    def _small_copies(self, model, source, target, max_width):
        """Build the small srcset size wherever it is missing."""
        for obj in model.objects.all():
            src, dst = getattr(obj, source), getattr(obj, target)
            if not src or not src.name or (dst and dst.name):
                continue
            self.changed += 1
            if self.dry:
                self.stdout.write(f"{model.__name__} {obj.pk}: small {max_width}px copy of {src.name}")
                continue
            if save_small_copy(src, dst, max_width):
                model.objects.filter(pk=obj.pk).update(**{target: dst.name})
            else:
                self.stdout.write(self.style.ERROR(f"Failed small copy {model.__name__} {obj.pk}"))
        if model is HeroImage and not self.dry:
            from django.core.cache import cache
            cache.delete("hero_images_api_cache")
