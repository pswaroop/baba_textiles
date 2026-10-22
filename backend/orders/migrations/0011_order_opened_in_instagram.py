from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0010_order_payment_link"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="opened_in_instagram",
            field=models.BooleanField(default=False),
        ),
    ]
