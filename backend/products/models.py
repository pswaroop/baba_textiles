from django.db import models
from colorfield.fields import ColorField

from django.utils.text import slugify

class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, blank=True)
    image = models.ImageField(upload_to="categories/", blank=True, null=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super(Category, self).save(*args, **kwargs)

    def __str__(self):
        return self.name


class ProductTag(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name


from django.db import models

class Product(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    category = models.ForeignKey('Category', on_delete=models.CASCADE)
    description = models.TextField()

    # NEW FIELD for specific shipping cost
    shipping_charge = models.DecimalField(max_digits=10, decimal_places=2, default=50.00)

    has_sizes = models.BooleanField(default=True)

    # Pricing
    original_price = models.DecimalField(max_digits=10, decimal_places=2)
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    price = models.DecimalField(max_digits=10, decimal_places=2, editable=False)

    tags = models.ManyToManyField('ProductTag', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.original_price and self.discount_percentage:
            discount_amount = (self.original_price * self.discount_percentage) / 100
            self.price = self.original_price - discount_amount
        else:
            self.price = self.original_price
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="products/")

    def __str__(self):
        return self.product.name


class ProductColor(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="colors")
    name = models.CharField(max_length=100)
    color = ColorField(default='#FFFFFF')

    def __str__(self):
        return f"{self.product.name} - {self.name}"


SIZE_CHOICES = (
    ('XS', 'XS'),
    ('S', 'S'),
    ('M', 'M'),
    ('L', 'L'),
    ('XL', 'XL'),
    ('XXL', 'XXL'),
    ('3XL', '3XL'),

)


class ProductVariant(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    color = models.ForeignKey(ProductColor, on_delete=models.CASCADE)
    size = models.CharField(max_length=5, choices=SIZE_CHOICES)
    stock = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('product', 'color', 'size')

    def __str__(self):
        return f"{self.product.name} - {self.color.name} - {self.size}"

    @property
    def is_out_of_stock(self):
        return self.stock == 0


class ProductColorImage(models.Model):
    color = models.ForeignKey(ProductColor, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="products/colors/")

    def __str__(self):
        return f"{self.color.product.name} - {self.color.name}"

class HeroImage(models.Model):
    image = models.ImageField(upload_to="hero/")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"Hero Image {self.id}"