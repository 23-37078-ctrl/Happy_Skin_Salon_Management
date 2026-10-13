import pytest
import requests

from app.services import sms_service


class FakeResponse:
    def __init__(self, status_code, body):
        self.status_code = status_code
        self.body = body

    def json(self):
        return self.body

    def raise_for_status(self):
        if self.status_code >= 400:
            error = requests.HTTPError("provider error")
            error.response = self
            raise error


def test_normalize_philippine_phone_numbers():
    assert sms_service._normalize_phone_number("0917 123 4567") == "639171234567"
    assert sms_service._normalize_phone_number("+639171234567") == "639171234567"
    assert sms_service._normalize_phone_number("639171234567") == "639171234567"


@pytest.mark.parametrize("phone", ["", "0917123456", "08171234567", "12345678901"])
def test_reject_invalid_phone_numbers(phone):
    with pytest.raises(ValueError):
        sms_service._normalize_phone_number(phone)


def test_send_sms_uses_documented_request_and_requires_message_id(monkeypatch):
    monkeypatch.setattr(sms_service.settings, "IPROG_API_TOKEN", "secret-token")
    calls = {}

    def fake_post(url, **kwargs):
        calls.update(url=url, **kwargs)
        return FakeResponse(200, {"status": 200, "message": "queued", "message_id": "message-1"})

    monkeypatch.setattr(sms_service.requests, "post", fake_post)
    sms_service.send_verification_sms("09171234567", "Test User", "123456")

    assert calls["url"] == "https://www.iprogsms.com/api/v1/sms_messages"
    assert calls["params"] == {"api_token": "secret-token"}
    assert calls["json"]["api_token"] == "secret-token"
    assert calls["json"]["phone_number"] == "639171234567"
    assert "123456" in calls["json"]["message"]
    assert calls["timeout"] == 10


def test_http_200_provider_error_is_not_success(monkeypatch):
    monkeypatch.setattr(sms_service.settings, "IPROG_API_TOKEN", "secret-token")
    monkeypatch.setattr(
        sms_service.requests,
        "post",
        lambda *args, **kwargs: FakeResponse(200, {"status": "error", "message": "Invalid Token"}),
    )

    with pytest.raises(RuntimeError, match="Invalid Token"):
        sms_service.send_verification_sms("09171234567", "Test User", "123456")


def test_missing_token_fails_before_request(monkeypatch):
    monkeypatch.setattr(sms_service.settings, "IPROG_API_TOKEN", " ")
    monkeypatch.setattr(sms_service.requests, "post", lambda *args, **kwargs: pytest.fail("unexpected provider call"))

    with pytest.raises(RuntimeError, match="not configured"):
        sms_service.send_verification_sms("09171234567", "Test User", "123456")


def test_provider_timeout_is_reported(monkeypatch):
    monkeypatch.setattr(sms_service.settings, "IPROG_API_TOKEN", "secret-token")
    monkeypatch.setattr(
        sms_service.requests,
        "post",
        lambda *args, **kwargs: (_ for _ in ()).throw(requests.Timeout()),
    )

    with pytest.raises(RuntimeError, match="timed out"):
        sms_service.send_verification_sms("09171234567", "Test User", "123456")
