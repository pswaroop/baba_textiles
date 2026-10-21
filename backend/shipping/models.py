from django.db import models


class IndiaPostConfig(models.Model):
    """Singleton row holding runtime state for the India Post integration:
    the cached bearer token (refreshed via the login API as it expires) and
    the booking office ID resolved for the sender pincode (looked up once via
    the Pincode Search API and cached here to avoid calling it on every booking).
    """

    access_token = models.TextField(blank=True, null=True)
    refresh_token = models.TextField(blank=True, null=True)
    token_expires_at = models.DateTimeField(blank=True, null=True)

    pickup_office_id = models.CharField(max_length=20, blank=True, null=True)

    # Next barcode number to hand out. India Post allocates a barcode range
    # per contract (test range: ET21433001XIN-ET21434000XIN); this counter
    # walks through that range. Update start/end/prefix/suffix here once a
    # production range is issued.
    barcode_prefix = models.CharField(max_length=4, default="ET")
    barcode_suffix = models.CharField(max_length=4, default="XIN")
    barcode_next_number = models.BigIntegerField(default=21433001)
    barcode_end_number = models.BigIntegerField(default=21434000)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "India Post Config"
        verbose_name_plural = "India Post Config"

    def __str__(self):
        return "India Post Config"

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def next_barcode(self):
        """Atomically claim the next barcode in the allocated range."""
        if self.barcode_next_number > self.barcode_end_number:
            raise ValueError(
                "India Post barcode range exhausted "
                f"({self.barcode_prefix}{self.barcode_end_number}{self.barcode_suffix}). "
                "Request a new barcode range and update IndiaPostConfig."
            )
        barcode = f"{self.barcode_prefix}{self.barcode_next_number}{self.barcode_suffix}"
        self.barcode_next_number += 1
        self.save(update_fields=["barcode_next_number"])
        return barcode


class Shipment(models.Model):
    STATUS_PENDING = "pending"
    STATUS_BOOKED = "booked"
    STATUS_BOOKING_FAILED = "booking_failed"
    STATUS_IN_TRANSIT = "in_transit"
    STATUS_DELIVERED = "delivered"
    STATUS_FAILED_DELIVERY = "failed_delivery"
    STATUS_RETURNED = "returned"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending Booking"),
        (STATUS_BOOKED, "Booked"),
        (STATUS_BOOKING_FAILED, "Booking Failed"),
        (STATUS_IN_TRANSIT, "In Transit"),
        (STATUS_DELIVERED, "Delivered"),
        (STATUS_FAILED_DELIVERY, "Failed Delivery"),
        (STATUS_RETURNED, "Returned"),
    ]

    SERVICE_BUSINESS_PARCEL = "BUSINESS_PARCEL"
    SERVICE_SP_INLAND_DOC = "SP_INLAND_DOC"
    SERVICE_SP_INLAND_PARCEL = "SP_INLAND_PARCEL"
    SERVICE_24_SPEEDPOST_DOC = "24_SPEEDPOST_DOC"
    SERVICE_24_SPP_PARSPL = "24_SPP_PARSPL"
    SERVICE_48_SPEEDPOST_DOC = "48_SPEEDPOST_DOC"

    SERVICE_CHOICES = [
        (SERVICE_BUSINESS_PARCEL, "Business Parcel"),
        (SERVICE_SP_INLAND_DOC, "Speed Post - Document (<500g)"),
        (SERVICE_SP_INLAND_PARCEL, "Speed Post - Parcel (>=500g)"),
        (SERVICE_24_SPEEDPOST_DOC, "24hr Speed Post - Document"),
        (SERVICE_24_SPP_PARSPL, "24hr Speed Post - Parcel"),
        (SERVICE_48_SPEEDPOST_DOC, "48hr Speed Post - Document"),
    ]

    order = models.OneToOneField(
        "orders.Order",
        on_delete=models.CASCADE,
        related_name="shipment",
    )

    service_type = models.CharField(
        max_length=20, choices=SERVICE_CHOICES, default=SERVICE_BUSINESS_PARCEL
    )
    barcode_no = models.CharField(max_length=13, unique=True, blank=True, null=True, db_index=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True
    )

    physical_weight_grams = models.PositiveIntegerField(blank=True, null=True)
    length_cm = models.PositiveIntegerField(blank=True, null=True)
    breadth_cm = models.PositiveIntegerField(blank=True, null=True)
    height_cm = models.PositiveIntegerField(blank=True, null=True)

    booking_request_payload = models.JSONField(blank=True, null=True)
    booking_response_payload = models.JSONField(blank=True, null=True)
    booking_error = models.TextField(blank=True, null=True)
    booked_at = models.DateTimeField(blank=True, null=True)

    calculated_tariff = models.DecimalField(
        max_digits=10, decimal_places=2, blank=True, null=True
    )

    last_tracking_status = models.CharField(max_length=100, blank=True, null=True)
    last_tracking_event = models.CharField(max_length=255, blank=True, null=True)
    last_tracking_office = models.CharField(max_length=255, blank=True, null=True)
    last_tracking_synced_at = models.DateTimeField(blank=True, null=True)
    delivered_at = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["barcode_no"]),
        ]

    def __str__(self):
        return f"Shipment for {self.order.order_number} ({self.barcode_no or 'unbooked'})"


class ShipmentTrackingEvent(models.Model):
    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.CASCADE,
        related_name="tracking_events",
    )

    event_date = models.DateField(blank=True, null=True)
    event_time = models.CharField(max_length=20, blank=True, null=True)
    office_name = models.CharField(max_length=255, blank=True, null=True)
    office_id = models.CharField(max_length=20, blank=True, null=True)
    description = models.CharField(max_length=255, blank=True, null=True)

    raw = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-event_date", "-created_at"]
        indexes = [
            models.Index(fields=["shipment", "-event_date"]),
        ]
        unique_together = ("shipment", "event_date", "event_time", "description")

    def __str__(self):
        return f"{self.shipment.barcode_no} - {self.description} ({self.event_date})"
