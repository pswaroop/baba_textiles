from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0009_order_payment_error_order_stock_released"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="payment_link_id",
            field=models.CharField(blank=True, db_index=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="payment_link_url",
            field=models.URLField(blank=True, max_length=300, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="payment_link_sent_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="payment_link_expires_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
