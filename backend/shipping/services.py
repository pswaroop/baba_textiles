"""India Post (Department of Posts) external API client.

Wraps the sandbox/production REST APIs documented in
`postoffice api integrations.docx`: login, pincode/office lookup, tariff
calculation, bulk booking (process-articles) and bulk tracking. Bearer tokens
and the resolved pickup office ID are cached on the `IndiaPostConfig`
singleton row so repeated bookings/tracking syncs don't re-authenticate or
re-resolve the office ID every call.
"""
from datetime import timedelta

import requests
from django.conf import settings
from django.utils import timezone

from .models import IndiaPostConfig, Shipment


class IndiaPostAPIError(Exception):
    """Raised for any non-2xx or `success: false` response from India Post."""

    def __init__(self, message, response=None, payload=None):
        super().__init__(message)
        self.response = response
        self.payload = payload


def _digits_only(value, length=None):
    value = "".join(ch for ch in str(value or "") if ch.isdigit())
    if length:
        value = value[-length:]
    return value


def split_address_lines(address_text, line_length=80):
    """India Post caps address lines at 80 chars; split a free-text address
    (as stored on Order.address) into line1/line2 rather than truncating."""
    text = (address_text or "").replace("\n", ", ").strip()
    if len(text) <= line_length:
        return text, ""

    # Break on the last comma/space before the limit so words aren't cut mid-word.
    cut = text.rfind(",", 0, line_length)
    if cut == -1:
        cut = text.rfind(" ", 0, line_length)
    if cut == -1:
        cut = line_length

    line1 = text[:cut].strip(", ")
    line2 = text[cut:].strip(", ")
    return line1[:line_length], line2[:line_length]


def next_pickup_schedule_date(slot=None):
    """India Post expects `MM/DD/YYYY HH:MM:SS AM/PM`. Schedules the pickup
    for the next day at the start of the configured slot."""
    slot = slot or settings.INDIAPOST_PICKUP_SLOT
    start_hour = 10
    try:
        start_hour = int(slot.split("-")[0].split(":")[0])
    except (ValueError, IndexError, AttributeError):
        pass

    pickup_dt = (timezone.localtime() + timedelta(days=1)).replace(
        hour=start_hour, minute=0, second=0, microsecond=0
    )
    return pickup_dt.strftime("%m/%d/%Y %I:%M:%S %p")


class IndiaPostClient:
    def __init__(self):
        self.base_url = settings.INDIAPOST_BASE_URL.rstrip("/")

    # ------------------------------------------------------------------
    # Auth
    # ------------------------------------------------------------------
    def _login(self):
        resp = requests.post(
            f"{self.base_url}/beextcustomer/v1/access/login",
            json={
                "username": settings.INDIAPOST_USERNAME,
                "password": settings.INDIAPOST_PASSWORD,
            },
            timeout=20,
        )
        try:
            data = resp.json()
        except ValueError:
            data = {}

        if not resp.ok or not data.get("success"):
            raise IndiaPostAPIError(
                f"India Post login failed: {data.get('message') or resp.text}",
                response=resp,
            )

        token_data = data["data"]
        config = IndiaPostConfig.load()
        config.access_token = token_data["access_token"]
        config.refresh_token = token_data.get("refresh_token")
        expires_in = int(token_data.get("expires_in") or 0)
        # Refresh a little early so a long-running request never straddles expiry.
        config.token_expires_at = timezone.now() + timedelta(seconds=max(expires_in - 30, 0))
        config.save(update_fields=["access_token", "refresh_token", "token_expires_at"])
        return config.access_token

    def get_access_token(self):
        config = IndiaPostConfig.load()
        if config.access_token and config.token_expires_at and config.token_expires_at > timezone.now():
            return config.access_token
        return self._login()

    def _request(self, method, path, retry_on_auth_fail=True, **kwargs):
        url = f"{self.base_url}{path}"
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {self.get_access_token()}"
        resp = requests.request(method, url, headers=headers, timeout=30, **kwargs)

        if resp.status_code == 401 and retry_on_auth_fail:
            self._login()
            return self._request(method, path, retry_on_auth_fail=False, headers=headers, **kwargs)

        return resp

    # ------------------------------------------------------------------
    # Pincode / office lookup
    # ------------------------------------------------------------------
    def search_offices(self, pincode, office_type="post", limit=50):
        resp = self._request(
            "GET",
            "/bemasterdata/v1/offices/limited-details",
            params={"pincode": pincode, "limit": limit, "office-type": office_type},
        )
        if not resp.ok:
            raise IndiaPostAPIError(
                f"Pincode search failed for {pincode}: {resp.text}", response=resp
            )
        return resp.json()

    def resolve_pickup_office_id(self, force_refresh=False):
        config = IndiaPostConfig.load()
        if config.pickup_office_id and not force_refresh:
            return config.pickup_office_id

        if settings.INDIAPOST_PICKUP_OFFICE_ID:
            config.pickup_office_id = settings.INDIAPOST_PICKUP_OFFICE_ID
            config.save(update_fields=["pickup_office_id"])
            return config.pickup_office_id

        offices = self.search_offices(settings.INDIAPOST_SENDER_PINCODE)
        eligible = [
            o for o in offices
            if o.get("delivery_office_flag") and o.get("office_type_code") != "BPO"
        ]
        if not eligible:
            raise IndiaPostAPIError(
                "No eligible post office (delivery_office_flag=true, "
                f"not BPO) found for sender pincode {settings.INDIAPOST_SENDER_PINCODE}"
            )

        office_id = str(eligible[0]["office_id"])
        config.pickup_office_id = office_id
        config.save(update_fields=["pickup_office_id"])
        return office_id

    # ------------------------------------------------------------------
    # Booking
    # ------------------------------------------------------------------
    def shape_of_article_for(self, service_type):
        if service_type in (
            Shipment.SERVICE_SP_INLAND_DOC,
            Shipment.SERVICE_24_SPEEDPOST_DOC,
            Shipment.SERVICE_48_SPEEDPOST_DOC,
        ):
            return "DOC"
        return settings.INDIAPOST_DEFAULT_SHAPE  # ROLL or NROL

    def build_article_payload(self, order, *, barcode_no, service_type,
                               weight_grams, length_cm, breadth_cm, height_cm):
        contract_id = settings.INDIAPOST_CONTRACT_IDS.get(service_type)
        if not contract_id:
            raise IndiaPostAPIError(
                f"No INDIAPOST_CONTRACT_IDS entry configured for service type {service_type}"
            )

        address_line1, address_line2 = split_address_lines(order.address)
        is_pickup = settings.INDIAPOST_PICKUP_OR_DROPOFF == "PICKUP"

        payload = {
            "bulk_customer_id": settings.INDIAPOST_BULK_CUSTOMER_ID,
            "contract_id": contract_id,
            "barcode_no": barcode_no,
            "pickup_or_dropoff": settings.INDIAPOST_PICKUP_OR_DROPOFF,
            "pickup_dropoff_office_id": self.resolve_pickup_office_id(),
            "article_type": service_type,
            "physical_weight": weight_grams,
            "shape_of_article": self.shape_of_article_for(service_type),
            "length": length_cm,
            "breadth_diameter": breadth_cm,
            "height": height_cm,
            "sender_name": settings.INDIAPOST_SENDER_NAME,
            "sender_company": settings.INDIAPOST_SENDER_COMPANY,
            "sender_add_line_1": settings.INDIAPOST_SENDER_ADDRESS_LINE1,
            "sender_add_line_2": settings.INDIAPOST_SENDER_ADDRESS_LINE2,
            "sender_city": settings.INDIAPOST_SENDER_CITY,
            "sender_state": settings.INDIAPOST_SENDER_STATE,
            "sender_pincode": settings.INDIAPOST_SENDER_PINCODE,
            "sender_mobile_no": _digits_only(settings.INDIAPOST_SENDER_MOBILE, 10),
            "receiver_name": order.customer_name,
            "receiver_add_line_1": address_line1,
            "receiver_add_line_2": address_line2,
            "receiver_city": order.city or "",
            "receiver_state": order.state or "",
            "receiver_pincode": _digits_only(order.pincode, 6),
            "receiver_mobile_no": _digits_only(order.phone, 10),
            "alt_address_flag": "FALSE",
            "pickup_address_flag": "TRUE" if is_pickup else "FALSE",
            "ack": "FALSE",
            "reg": "FALSE",
            "otp": "FALSE",
            "bulk_reference": order.order_number,
        }

        if is_pickup:
            payload.update({
                "pickup_addressee_name": settings.INDIAPOST_SENDER_NAME,
                "pickup_company_name": settings.INDIAPOST_SENDER_COMPANY,
                "pickup_address_line1": settings.INDIAPOST_SENDER_ADDRESS_LINE1,
                "pickup_address_line2": settings.INDIAPOST_SENDER_ADDRESS_LINE2,
                "pickup_city": settings.INDIAPOST_SENDER_CITY,
                "pickup_state": settings.INDIAPOST_SENDER_STATE,
                "pickup_pincode": settings.INDIAPOST_SENDER_PINCODE,
                "pickup_mobile_no": _digits_only(settings.INDIAPOST_SENDER_MOBILE, 10),
                "pickup_schedule_slot": settings.INDIAPOST_PICKUP_SLOT,
                "pickup_schedule_date": next_pickup_schedule_date(),
            })

        return payload

    def book_articles(self, articles):
        """POST /process-articles/:customId — books one or more articles.

        Returns the parsed JSON response (contains `valid_articles` and
        `error_articles`, one entry per submitted article, in submission order).
        """
        resp = self._request(
            "POST",
            f"/beextcustomer/process-articles/{settings.INDIAPOST_BULK_CUSTOMER_ID}",
            json={"articles": articles},
        )
        try:
            data = resp.json()
        except ValueError:
            raise IndiaPostAPIError(
                f"India Post booking returned a non-JSON response: {resp.text}",
                response=resp,
            )

        if resp.status_code >= 500:
            raise IndiaPostAPIError(
                f"India Post booking service error ({resp.status_code}): {data}",
                response=resp, payload=data,
            )

        return data

    # ------------------------------------------------------------------
    # Tracking
    # ------------------------------------------------------------------
    def track_bulk(self, barcodes):
        """POST /v1/tracking/bulk — up to 500 barcodes per call."""
        if len(barcodes) > 500:
            raise ValueError("India Post tracking/bulk accepts at most 500 barcodes per call")

        resp = self._request(
            "POST",
            "/beextcustomer/v1/tracking/bulk",
            json={"bulk": list(barcodes)},
        )
        try:
            data = resp.json()
        except ValueError:
            raise IndiaPostAPIError(
                f"India Post tracking returned a non-JSON response: {resp.text}",
                response=resp,
            )

        if not resp.ok:
            raise IndiaPostAPIError(
                f"India Post tracking failed: {data.get('message') or resp.text}",
                response=resp, payload=data,
            )

        return data
