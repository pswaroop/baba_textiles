from django.core.cache import cache
from django.db.models.signals import m2m_changed, post_delete, post_save
from django.dispatch import receiver

from .models import Category, Product, ProductImage, ProductVariant


STOCK_ONLY = {"stock", "reserved_stock"}


def _drop_product_list_cache(sender=None, update_fields=None, **kwargs):
    # Checkout reserves and deducts stock on every order; rebuilding the list
    # each time would defeat the cache. Stock shown may lag up to a minute.
    if update_fields and set(update_fields) <= STOCK_ONLY:
        return
    from .views import ALL_TAGGED_CACHE_KEY
    cache.delete(ALL_TAGGED_CACHE_KEY)


# Any change to what the shop lists makes the cached product list stale.
for _model in (Product, ProductVariant, ProductImage, Category):
    post_save.connect(_drop_product_list_cache, sender=_model, dispatch_uid=f"drop_list_save_{_model.__name__}")
    post_delete.connect(_drop_product_list_cache, sender=_model, dispatch_uid=f"drop_list_delete_{_model.__name__}")
m2m_changed.connect(_drop_product_list_cache, sender=Product.tags.through, dispatch_uid="drop_list_tags")
