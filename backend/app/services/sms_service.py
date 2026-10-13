import logging
import re

import requests
from app.core.config import settings

IPROG_BASE_URL = "https://www.iprogsms.com/api/v1"
logger = logging.getLogger(__name__)


def _normalize_phone_number(phone_number: str) -> str:
    cleaned = re.sub(r"[\s()-]", "", phone_number or "")
    if cleaned.startswith("+63"):
        cleaned = cleaned[1:]
    elif cleaned.startswith("09"):
        cleaned = "63" + cleaned[1:]

    if not re.fullmatch(r"639\d{9}", cleaned):
        raise ValueError("Enter a valid Philippine mobile number.")
    return cleaned


def send_verification_sms(phone_number: str, full_name: str, otp: str) -> None:
    """
    Sends OTP via iProgSMS API.
    Docs: https://sms.iprogtech.com/api/v1/documentation

    Phone number format: 09171234567 or 639171234567
    iProgSMS accepts both formats.
    """

    cleaned = _normalize_phone_number(phone_number)

    if not settings.IPROG_API_TOKEN.strip():
        raise RuntimeError("iProgSMS is not configured. Set IPROG_API_TOKEN on the backend.")

    message = (
        f"Your verification code is {otp}. "
        f"It expires in 10 minutes. Do not share this code with anyone."
    )

    payload = {
        "api_token": settings.IPROG_API_TOKEN,
        "phone_number": cleaned,
        "message": message,
    }

    try:
        response = requests.post(
            f"{IPROG_BASE_URL}/sms_messages",
            params={"api_token": settings.IPROG_API_TOKEN},
            json=payload,
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            timeout=10,
        )
        response.raise_for_status()

        try:
            result = response.json()
        except ValueError as exc:
            raise RuntimeError("iProgSMS returned an unreadable response.") from exc

        provider_status = result.get("status") if isinstance(result, dict) else None
        success = (
            response.status_code in (200, 201)
            and provider_status in (200, "200", 201, "201", "success")
            and bool(result.get("message_id"))
        )
        if not success:
            provider_message = result.get("message", "Unknown error") if isinstance(result, dict) else "Unknown error"
            raise RuntimeError(
                f"iProgSMS error {response.status_code}: {provider_message}"
            )
        logger.info("iProgSMS accepted OTP message (HTTP %s).", response.status_code)

    except requests.exceptions.Timeout:
        logger.warning("iProgSMS OTP request timed out.")
        raise RuntimeError("iProgSMS request timed out. Check your internet connection.")
    except requests.exceptions.RequestException as e:
        status_code = e.response.status_code if e.response is not None else "unavailable"
        logger.warning("iProgSMS OTP request failed (HTTP %s).", status_code)
        raise RuntimeError(f"SMS delivery failed (provider HTTP {status_code}).") from e
