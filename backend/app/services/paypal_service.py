"""Server-side PayPal Orders v2 client for the Sandbox-first booking flow."""

from decimal import Decimal, ROUND_HALF_UP
import logging
from threading import Lock
import time
from typing import Any

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)


class PayPalApiError(Exception):
    """A safe-to-report PayPal API failure; never contains credentials."""


_token_lock = Lock()
_cached_access_token: str | None = None
_cached_token_expires_at = 0.0


def is_paypal_configured(*, require_webhook: bool = False) -> bool:
    configured = settings.PAYPAL_MODE.lower() == "sandbox" and bool(settings.PAYPAL_CLIENT_ID and settings.PAYPAL_CLIENT_SECRET)
    return configured and (not require_webhook or bool(settings.PAYPAL_WEBHOOK_ID))


def _base_url() -> str:
    return "https://api-m.sandbox.paypal.com"


def _get_access_token() -> str:
    global _cached_access_token, _cached_token_expires_at

    if not is_paypal_configured():
        raise PayPalApiError("PayPal Sandbox credentials are not configured.")

    with _token_lock:
        if _cached_access_token and time.monotonic() < _cached_token_expires_at - 60:
            return _cached_access_token
        try:
            response = requests.post(
                f"{_base_url()}/v1/oauth2/token",
                auth=(settings.PAYPAL_CLIENT_ID, settings.PAYPAL_CLIENT_SECRET),
                data={"grant_type": "client_credentials"},
                headers={"Accept": "application/json", "Accept-Language": "en_US"},
                timeout=15,
            )
            response.raise_for_status()
            payload = response.json()
            token = payload.get("access_token")
            expires_in = int(payload.get("expires_in", 0))
            if not token or expires_in <= 0:
                raise PayPalApiError("PayPal returned an invalid access-token response.")
        except requests.RequestException as exc:
            raise PayPalApiError("PayPal authentication is temporarily unavailable.") from exc
        except (ValueError, TypeError) as exc:
            raise PayPalApiError("PayPal returned an invalid access-token response.") from exc

        _cached_access_token = token
        _cached_token_expires_at = time.monotonic() + expires_in
        return token


def _request(
    method: str,
    path: str,
    *,
    body: dict[str, Any] | None = None,
    request_id: str | None = None,
) -> dict[str, Any]:
    global _cached_access_token, _cached_token_expires_at

    for retry in range(2):
        headers = {"Authorization": f"Bearer {_get_access_token()}", "Content-Type": "application/json"}
        if request_id:
            headers["PayPal-Request-Id"] = request_id
        try:
            response = requests.request(
                method,
                f"{_base_url()}{path}",
                headers=headers,
                json=body,
                timeout=20,
            )
            if response.status_code == 401 and retry == 0:
                with _token_lock:
                    _cached_access_token = None
                    _cached_token_expires_at = 0.0
                continue
            response.raise_for_status()
            return response.json() if response.content else {}
        except requests.HTTPError as exc:
            code = exc.response.status_code if exc.response is not None else "unknown"
            raise PayPalApiError(f"PayPal rejected the payment request (HTTP {code}).") from exc
        except requests.RequestException as exc:
            raise PayPalApiError("PayPal is temporarily unavailable. Please retry the payment.") from exc
        except ValueError as exc:
            raise PayPalApiError("PayPal returned an invalid payment response.") from exc
    raise PayPalApiError("PayPal authentication expired. Please retry the payment.")


def create_order(*, amount: Decimal | float, reference: str, description: str, request_id: str) -> dict[str, Any]:
    value = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "reference_id": "salon-booking",
                "custom_id": reference,
                "invoice_id": reference,
                "description": description[:127],
                "amount": {"currency_code": "PHP", "value": f"{value:.2f}"},
            }
        ],
    }
    return _request("POST", "/v2/checkout/orders", body=payload, request_id=request_id)


def get_order(order_id: str) -> dict[str, Any]:
    return _request("GET", f"/v2/checkout/orders/{order_id}")


def capture_order(order_id: str, *, request_id: str) -> dict[str, Any]:
    return _request("POST", f"/v2/checkout/orders/{order_id}/capture", body={}, request_id=request_id)


def verify_webhook_signature(event: dict[str, Any], headers: dict[str, str]) -> bool:
    if not is_paypal_configured(require_webhook=True):
        return False

    payload = {
        "auth_algo": headers.get("paypal-auth-algo"),
        "cert_url": headers.get("paypal-cert-url"),
        "transmission_id": headers.get("paypal-transmission-id"),
        "transmission_sig": headers.get("paypal-transmission-sig"),
        "transmission_time": headers.get("paypal-transmission-time"),
        "webhook_id": settings.PAYPAL_WEBHOOK_ID,
        "webhook_event": event,
    }
    if not all(payload.get(key) for key in (
        "auth_algo", "cert_url", "transmission_id", "transmission_sig", "transmission_time"
    )):
        return False

    result = _request("POST", "/v1/notifications/verify-webhook-signature", body=payload)
    return result.get("verification_status") == "SUCCESS"
