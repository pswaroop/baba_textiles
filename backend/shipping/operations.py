"""High-level India Post operations used by the admin actions and the
tracking-sync management command. Keeps the raw HTTP client (services.py)
separate from "what a booking/tracking-sync actually does to our data".
"""
from datetime import datetime

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from orders.models import Order
from .models import IndiaPostConfig, Shipment, ShipmentTrackingEvent
from .services import IndiaPostAPIError, IndiaPostClient


class ShipmentBookingError(Exception):
    pass


def _package_dimensions_for_order(order):
    """Sum per-unit product weight/dimensions across order items. Falls back
    to the store-wide INDIAPOST_DEFAULT_* settings for items missing data,
    and takes the max length/breadth/height rather than summing them (items
    are assumed to be packed together in one box, not stacked end to end)."""
    total_weight = 0
    max_length = settings.INDIAPOST_DEFAULT_LENGTH_CM
    max_breadth = settings.INDIAPOST_DEFAULT_BREADTH_CM
    max_height = settings.INDIAPOST_DEFAULT_HEIGHT_CM

    items = order.items.select_related("variant__product").all()
    if not items:
        return (
            settings.INDIAPOST_DEFAULT_WEIGHT_GRAMS,
            max_length,
            max_breadth,
            max_height,
        )

    for item in items:
        product = item.variant.product
        unit_weight = product.weight_grams or settings.INDIAPOST_DEFAULT_WEIGHT_GRAMS
        total_weight += unit_weight * item.quantity
        max_length = max(max_length, product.length_cm or 0)
        max_breadth = max(max_breadth, product.breadth_cm or 0)
        max_height = max(max_height, product.height_cm or 0)

    return (
        max(total_weight, 1),
        max_length or settings.INDIAPOST_DEFAULT_LENGTH_CM,
        max_breadth or settings.INDIAPOST_DEFAULT_BREADTH_CM,
        max_height or settings.INDIAPOST_DEFAULT_HEIGHT_CM,
    )


def _resolve_service_type(weight_grams):
    """Speed Post splits into a DOC vs PARCEL product code at the 500g mark;
    Business Parcel and the NDD products don't, so pass those through as-is."""
    default = settings.INDIAPOST_DEFAULT_SERVICE_TYPE
    if default in (Shipment.SERVICE_SP_INLAND_DOC, Shipment.SERVICE_SP_INLAND_PARCEL):
        return Shipment.SERVICE_SP_INLAND_DOC if weight_grams < 500 else Shipment.SERVICE_SP_INLAND_PARCEL
    return default


def prepare_shipment_for_order(order, *, service_type=None):
    """Ensures `order` has a Shipment row with a reserved barcode and
    computed weight/dimensions, WITHOUT calling the India Post booking API.

    Shared by book_shipment_for_order (JSON API booking) and the "Export to
    Excel" admin action (manual/portal upload channel) so both ways of
    booking a shipment draw barcodes from the same counter and always agree
    on an order's package weight/dimensions.

    Raises ShipmentBookingError if the order isn't paid yet or already has
    an active shipment (booked/in_transit/delivered) — in either case there's
    nothing new to prepare.
    """
    if order.payment_status != "paid":
        raise ShipmentBookingError(
            f"Order {order.order_number} is not paid (payment_status={order.payment_status})."
        )

    shipment, _ = Shipment.objects.get_or_create(order=order)

    if shipment.status in (Shipment.STATUS_BOOKED, Shipment.STATUS_IN_TRANSIT, Shipment.STATUS_DELIVERED):
        raise ShipmentBookingError(
            f"Order {order.order_number} already has a shipment (status={shipment.status}, "
            f"barcode={shipment.barcode_no})."
        )

    weight_grams, length_cm, breadth_cm, height_cm = _package_dimensions_for_order(order)
    service_type = service_type or _resolve_service_type(weight_grams)
    config = IndiaPostConfig.load()

    with transaction.atomic():
        if not shipment.barcode_no:
            shipment.barcode_no = config.next_barcode()

        shipment.service_type = service_type
        shipment.physical_weight_grams = weight_grams
        shipment.length_cm = length_cm
        shipment.breadth_cm = breadth_cm
        shipment.height_cm = height_cm
        shipment.save()

    return shipment


def book_shipment_for_order(order, *, service_type=None, client=None):
    """Books `order` with India Post via the JSON booking API.

    Raises ShipmentBookingError for anything that should stop the admin
    action and show a message (order not paid, already booked, API error).
    Per-article validation errors from India Post are *not* raised — they're
    stored on the Shipment (status=booking_failed, booking_error) so staff
    can see exactly what India Post rejected and retry after fixing it.
    """
    shipment = prepare_shipment_for_order(order, service_type=service_type)
    client = client or IndiaPostClient()

    payload = client.build_article_payload(
        order,
        barcode_no=shipment.barcode_no,
        service_type=shipment.service_type,
        weight_grams=shipment.physical_weight_grams,
        length_cm=shipment.length_cm,
        breadth_cm=shipment.breadth_cm,
        height_cm=shipment.height_cm,
    )
    shipment.booking_request_payload = {"articles": [payload]}
    shipment.save(update_fields=["booking_request_payload"])

    try:
        response = client.book_articles([payload])
    except IndiaPostAPIError as exc:
        shipment.status = Shipment.STATUS_BOOKING_FAILED
        shipment.booking_error = str(exc)
        shipment.booking_response_payload = getattr(exc, "payload", None)
        shipment.save(update_fields=["status", "booking_error", "booking_response_payload"])
        raise ShipmentBookingError(str(exc)) from exc

    shipment.booking_response_payload = response

    error_articles = response.get("error_articles") or []
    valid_articles = response.get("valid_articles") or []

    if error_articles and not valid_articles:
        errors = error_articles[0].get("errors") or []
        shipment.status = Shipment.STATUS_BOOKING_FAILED
        shipment.booking_error = "; ".join(errors) or "India Post rejected the article."
        shipment.save(update_fields=["status", "booking_error", "booking_response_payload"])
        raise ShipmentBookingError(
            f"India Post rejected the booking for {order.order_number}: {shipment.booking_error}"
        )

    booked_article = valid_articles[0]
    shipment.status = Shipment.STATUS_BOOKED
    shipment.booking_error = ""
    shipment.booked_at = timezone.now()
    shipment.calculated_tariff = booked_article.get("calculated_tariff")
    shipment.save(update_fields=[
        "status", "booking_error", "booked_at", "calculated_tariff", "booking_response_payload",
    ])

    return shipment


def _parse_ddmmyyyy_or_iso(value):
    if not value:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d", "%d%m%Y"):
        try:
            return datetime.strptime(value[:len(fmt) + 4] if "T" in value else value, fmt).date()
        except ValueError:
            continue
    return None


def sync_tracking_for_shipments(shipments, *, client=None):
    """Calls tracking/bulk for the given shipments (chunked to <=500), records
    any new tracking events, and progresses Shipment/Order status based on
    the response (dispatched -> in_transit/shipped, delivered -> delivered).

    Returns a dict summary: {"synced": n, "delivered": n, "errors": [...]}.
    """
    client = client or IndiaPostClient()
    shipments = [s for s in shipments if s.barcode_no]
    by_barcode = {s.barcode_no: s for s in shipments}

    summary = {"synced": 0, "delivered": 0, "errors": []}

    barcodes = list(by_barcode.keys())
    for i in range(0, len(barcodes), 500):
        batch = barcodes[i:i + 500]
        try:
            response = client.track_bulk(batch)
        except IndiaPostAPIError as exc:
            summary["errors"].append(str(exc))
            continue

        for entry in response.get("data") or []:
            booking_details = entry.get("booking_details") or {}
            article_number = booking_details.get("article_number")
            shipment = by_barcode.get(article_number)
            if not shipment:
                continue

            tracking_details = entry.get("tracking_details") or []
            for event in tracking_details:
                ShipmentTrackingEvent.objects.get_or_create(
                    shipment=shipment,
                    event_date=_parse_ddmmyyyy_or_iso(event.get("date")),
                    event_time=event.get("time") or "",
                    description=event.get("event") or "",
                    defaults={
                        "office_name": event.get("office"),
                        "office_id": event.get("officeid"),
                        "raw": event,
                    },
                )

            del_status = (entry.get("del_status") or {}).get("del_status", "")
            latest_event = tracking_details[-1] if tracking_details else None

            shipment.last_tracking_synced_at = timezone.now()
            if latest_event:
                shipment.last_tracking_event = latest_event.get("event")
                shipment.last_tracking_office = latest_event.get("office")
            shipment.last_tracking_status = del_status or shipment.last_tracking_status

            order = shipment.order
            if del_status.lower() == "delivered":
                shipment.status = Shipment.STATUS_DELIVERED
                shipment.delivered_at = shipment.delivered_at or timezone.now()
                if order.status != "delivered":
                    order.status = "delivered"
                    order.save(update_fields=["status"])
                summary["delivered"] += 1
            elif tracking_details and shipment.status == Shipment.STATUS_BOOKED:
                shipment.status = Shipment.STATUS_IN_TRANSIT
                if order.status not in ("shipped", "delivered", "cancelled"):
                    order.status = "shipped"
                    order.save(update_fields=["status"])

            shipment.save(update_fields=[
                "last_tracking_synced_at", "last_tracking_event", "last_tracking_office",
                "last_tracking_status", "status", "delivered_at",
            ])
            summary["synced"] += 1

    return summary

