from pathlib import Path

from django.core.management.base import BaseCommand

from products.models import (
    Category,
    HeroImage,
    ProductImage,
    compress_image_to_webp,
    make_thumbnail_webp,
)


class Command(BaseCommand):
    help = (
        "Backfill: compress any product/category/hero images that are still "
        "raw originals to WebP, and generate any missing ProductImage thumbnails. "
        "Safe to re-run — already-compressed images and existing thumbnails are left alone."
    )

    def handle(self, *args, **kwargs):
        self._compress_product_images()
        self._backfill_thumbnails()
        self._compress_categories()
        self._compress_hero_images()
        self.stdout.write(self.style.SUCCESS("Image backfill completed."))

    def _compress_product_images(self):
        images = list(ProductImage.objects.all())
        self.stdout.write(f"Checking {len(images)} product images...")
        for img in images:
            if not img.image or img.image.name.lower().endswith(".webp"):
                continue
            try:
                compress_image_to_webp(img.image, max_width=800, quality=80)
                img.save(update_fields=None)
                self.stdout.write(self.style.SUCCESS(f"Compressed {img.image.name}"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Failed: {img.pk} - {e}"))

    def _backfill_thumbnails(self):
        missing = ProductImage.objects.filter(image__isnull=False).exclude(image="")
        missing = [img for img in missing if img.image and not img.thumbnail]
        self.stdout.write(f"Generating {len(missing)} missing thumbnails...")
        for img in missing:
            try:
                thumb = make_thumbnail_webp(img.image, max_width=400, quality=72)
                if thumb is None:
                    continue
                stem = Path(img.image.name).stem
                img.thumbnail.save(f"{stem}_thumb.webp", thumb, save=True)
                self.stdout.write(self.style.SUCCESS(f"Thumbnail for {img.image.name}"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Failed thumbnail: {img.pk} - {e}"))

    def _compress_categories(self):
        cats = [c for c in Category.objects.all() if c.image and not c.image.name.lower().endswith(".webp")]
        self.stdout.write(f"Compressing {len(cats)} raw category images...")
        for cat in cats:
            try:
                compress_image_to_webp(cat.image, max_width=450, quality=78)
                cat.save()
                self.stdout.write(self.style.SUCCESS(f"Compressed {cat.image.name}"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Failed: category {cat.pk} - {e}"))

    def _compress_hero_images(self):
        heroes = [h for h in HeroImage.objects.all() if h.image and not h.image.name.lower().endswith(".webp")]
        self.stdout.write(f"Compressing {len(heroes)} raw hero images...")
        for hero in heroes:
            try:
                compress_image_to_webp(hero.image, max_width=1000, quality=78)
                hero.save()
                self.stdout.write(self.style.SUCCESS(f"Compressed {hero.image.name}"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Failed: hero {hero.pk} - {e}"))
