from decimal import Decimal

from app.core.config import settings
from app.services import paypal_service


def test_sandbox_is_required_for_payments(monkeypatch):
    monkeypatch.setattr(settings, "PAYPAL_CLIENT_ID", "sandbox-client")
    monkeypatch.setattr(settings, "PAYPAL_CLIENT_SECRET", "sandbox-secret")
    monkeypatch.setattr(settings, "PAYPAL_MODE", "sandbox")
    monkeypatch.setattr(settings, "PAYPAL_WEBHOOK_ID", "webhook-id")

    assert paypal_service.is_paypal_configured()
    assert paypal_service.is_paypal_configured(require_webhook=True)
    assert paypal_service._base_url() == "https://api-m.sandbox.paypal.com"

    monkeypatch.setattr(settings, "PAYPAL_MODE", "live")
    assert not paypal_service.is_paypal_configured()
    assert paypal_service._base_url() == "https://api-m.sandbox.paypal.com"


def test_create_order_sends_authoritative_php_amount_and_idempotency(monkeypatch):
    recorded = {}

    def fake_request(method, path, *, body=None, request_id=None):
        recorded.update(method=method, path=path, body=body, request_id=request_id)
        return {"id": "ORDER-123"}

    monkeypatch.setattr(paypal_service, "_request", fake_request)
    result = paypal_service.create_order(
        amount=Decimal("1250.5"),
        reference="HS-10-attempt-1",
        description="Salon service",
        request_id="stable-request-id",
    )

    assert result["id"] == "ORDER-123"
    assert recorded["method"] == "POST"
    assert recorded["path"] == "/v2/checkout/orders"
    assert recorded["request_id"] == "stable-request-id"
    unit = recorded["body"]["purchase_units"][0]
    assert unit["amount"] == {"currency_code": "PHP", "value": "1250.50"}
    assert unit["invoice_id"] == "HS-10-attempt-1"


def test_webhook_verification_requires_all_paypal_headers(monkeypatch):
    monkeypatch.setattr(settings, "PAYPAL_CLIENT_ID", "sandbox-client")
    monkeypatch.setattr(settings, "PAYPAL_CLIENT_SECRET", "sandbox-secret")
    monkeypatch.setattr(settings, "PAYPAL_MODE", "sandbox")
    monkeypatch.setattr(settings, "PAYPAL_WEBHOOK_ID", "webhook-id")
    monkeypatch.setattr(paypal_service, "_request", lambda *args, **kwargs: {"verification_status": "SUCCESS"})
    event = {"event_type": "PAYMENT.CAPTURE.COMPLETED"}
    headers = {
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-cert-url": "https://api.paypal.com/cert",
        "paypal-transmission-id": "transmission-id",
        "paypal-transmission-sig": "signature",
        "paypal-transmission-time": "2026-10-31T00:00:00Z",
    }

    assert paypal_service.verify_webhook_signature(event, headers)
    assert not paypal_service.verify_webhook_signature(event, {})
