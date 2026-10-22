from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0011_order_opened_in_instagram"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="opened_on_android",
            field=models.BooleanField(default=False),
        ),
    ]
