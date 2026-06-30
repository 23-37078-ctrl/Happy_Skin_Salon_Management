import requests
from app.core.config import settings

IPROG_BASE_URL = "https://sms.iprogtech.com/api/v1"


def send_verification_sms(phone_number: str, full_name: str, otp: str) -> None:
    """
    Sends OTP via iProgSMS API.
    Docs: https://sms.iprogtech.com/api/v1/documentation

    Phone number format: 09171234567 or 639171234567
    iProgSMS accepts both formats.
    """

    # Normalize: strip spaces and dashes
    cleaned = phone_number.strip().replace(" ", "").replace("-", "")

    # Convert 09xx → 639xx (iProgSMS preferred format)
    if cleaned.startswith("09"):
        cleaned = "63" + cleaned[1:]
    elif cleaned.startswith("+63"):
        cleaned = cleaned[1:]  # strip the + sign

    # Custom OTP message — :otp is replaced by iProgSMS backend automatically
    message = (
        f"Hi {full_name}! Your Happy Skin verification code is: {otp}. "
        f"It expires in 10 minutes. Do not share this with anyone."
    )

    payload = {
        "api_token": settings.IPROG_API_TOKEN,
        "phone_number": cleaned,
        "message": message,
    }

    try:
        response = requests.post(
            f"{IPROG_BASE_URL}/sms_messages",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10,
        )

        result = response.json()

        # iProgSMS returns status 200 on success
        if response.status_code not in (200, 201):
            raise RuntimeError(
                f"iProgSMS error {response.status_code}: {result.get('message', 'Unknown error')}"
            )

    except requests.exceptions.Timeout:
        raise RuntimeError("iProgSMS request timed out. Check your internet connection.")
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"SMS delivery failed: {e}") from e