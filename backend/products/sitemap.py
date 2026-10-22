from xml.sax.saxutils import escape

from django.core.cache import cache
from django.http import HttpResponse
from django.utils.http import urlencode

from .models import Category, Product

SITE = "https://babatextiles.com"
SITEMAP_CACHE_KEY = "sitemap_xml_v1"


def sitemap_xml(request):
    """sitemap.xml for the storefront: main pages, categories and every
    product shown in the shop. Served at babatextiles.com/sitemap.xml (nginx
    sends that one path to Django); cached for an hour."""
    xml = cache.get(SITEMAP_CACHE_KEY)
    if xml is None:
        urls = [(f"{SITE}/", "daily", "1.0"), (f"{SITE}/shop", "daily", "0.9"),
                (f"{SITE}/about", "monthly", "0.4"), (f"{SITE}/contact", "monthly", "0.4")]
        for category in Category.objects.exclude(slug=""):
            urls.append((f"{SITE}/shop?{urlencode({'category': category.slug})}", "weekly", "0.7"))
        for product in Product.objects.filter(is_active=True).only("id"):
            urls.append((f"{SITE}/product/{product.id}", "weekly", "0.8"))
        body = "".join(
            f"<url><loc>{escape(loc)}</loc><changefreq>{freq}</changefreq><priority>{prio}</priority></url>"
            for loc, freq, prio in urls
        )
        xml = ('<?xml version="1.0" encoding="UTF-8"?>'
               f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>')
        cache.set(SITEMAP_CACHE_KEY, xml, 60 * 60)
    response = HttpResponse(xml, content_type="application/xml")
    response["Cache-Control"] = "public, max-age=3600"
    return response
