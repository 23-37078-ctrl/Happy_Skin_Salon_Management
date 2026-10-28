"""Branded transactional email delivery through the configured SMTP provider."""

import html
import smtplib
import ssl
from datetime import datetime
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

from app.core.config import settings


BRAND_NAME = "Happy Skin"
BRAND_DESCRIPTOR = "NAILS SPA · AESTHETICS · SALON"
BRAND_PLUM = "#5B294B"
BRAND_PINK = "#C85B95"
BRAND_BG = "#FBF6F8"
BRAND_BORDER = "#EEDFE7"


def _send_email(msg: MIMEMultipart, to_email: str) -> None:
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD or not settings.EMAIL_FROM:
        raise RuntimeError(
            "Email delivery is not configured. Set SMTP_USERNAME, SMTP_PASSWORD, and EMAIL_FROM in backend/.env."
        )

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
        server.ehlo()
        server.starttls(context=ssl.create_default_context())
        server.ehlo()
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.sendmail(settings.EMAIL_FROM, to_email, msg.as_string())


def _build_html(full_name: str, otp: str, *, purpose: str) -> str:
    """Build a self-contained HTML email with inline styles for inbox support."""
    safe_name = html.escape(full_name.strip() or "there", quote=True)
    safe_otp = html.escape(otp, quote=True)
    expiry = settings.OTP_EXPIRE_MINUTES

    if purpose == "verification":
        eyebrow = "WELCOME TO HAPPY SKIN"
        title = "Verify your email address"
        introduction = "Thanks for creating an account. Enter this one-time code to verify your email and continue setting up your Happy Skin account."
        security_note = "If you did not create a Happy Skin account, you can ignore this message. Never share this code with anyone."
        preheader = "Your one-time code to verify your Happy Skin email address."
    else:
        eyebrow = "ACCOUNT SECURITY"
        title = "Reset your password"
        introduction = "We received a request to reset the password for your Happy Skin account. Enter this one-time code to continue."
        security_note = "If you did not request a password reset, ignore this message. Your password will stay the same. Never share this code with anyone."
        preheader = "Your one-time code to reset your Happy Skin password."

    return f"""<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>{html.escape(title)}</title>
  <style>
    @media screen and (max-width: 600px) {{
      .email-shell {{ width: 100% !important; }}
      .content-pad {{ padding-left: 24px !important; padding-right: 24px !important; }}
      .otp-code {{ font-size: 30px !important; letter-spacing: 8px !important; }}
    }}
  </style>
</head>
<body style="margin:0;padding:0;background:{BRAND_BG};font-family:Arial,Helvetica,sans-serif;color:#352B32;-webkit-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;color:{BRAND_BG};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">{html.escape(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:{BRAND_BG};width:100%;">
    <tr><td align="center" style="padding:32px 12px;">
      <table class="email-shell" role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid {BRAND_BORDER};border-radius:18px;overflow:hidden;">
        <tr><td align="center" style="padding:28px 24px 25px;background:#fffafd;border-bottom:1px solid #F4E8EE;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td align="center" valign="middle" width="42" height="42" style="width:42px;height:42px;border-radius:50%;background:{BRAND_PLUM};color:#ffffff;font-family:Georgia,serif;font-size:17px;font-weight:bold;">HS</td>
            <td style="padding-left:11px;text-align:left;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:25px;font-weight:bold;letter-spacing:-.3px;color:{BRAND_PLUM};">Happy Skin</div>
              <div style="padding-top:3px;font-size:9px;line-height:13px;font-weight:bold;letter-spacing:1.2px;color:#98778B;">{BRAND_DESCRIPTOR}</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td class="content-pad" style="padding:38px 42px 34px;">
          <p style="margin:0 0 10px;color:{BRAND_PINK};font-size:10px;line-height:15px;font-weight:bold;letter-spacing:1.7px;">{eyebrow}</p>
          <h1 style="margin:0 0 14px;color:{BRAND_PLUM};font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:34px;font-weight:normal;">{html.escape(title)}</h1>
          <p style="margin:0 0 10px;color:#352B32;font-size:15px;line-height:23px;">Hi {safe_name},</p>
          <p style="margin:0 0 25px;color:#655A62;font-size:14px;line-height:22px;">{html.escape(introduction)}</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#FCF7FA;border:1px solid {BRAND_BORDER};border-radius:14px;">
            <tr><td align="center" style="padding:22px 16px 20px;">
              <p style="margin:0 0 12px;color:#846A7A;font-size:10px;line-height:15px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;">Your one-time code</p>
              <div class="otp-code" aria-label="One-time code {safe_otp}" style="display:inline-block;color:{BRAND_PLUM};font-family:Arial,Helvetica,sans-serif;font-size:34px;line-height:42px;font-weight:bold;letter-spacing:10px;padding-left:10px;">{safe_otp}</div>
              <p style="margin:12px 0 0;color:#846A7A;font-size:12px;line-height:18px;">Expires in <strong>{expiry} minutes</strong></p>
            </td></tr>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:22px;width:100%;">
            <tr><td width="3" style="width:3px;background:{BRAND_PINK};border-radius:3px;"></td><td style="padding:2px 0 2px 12px;color:#746771;font-size:12px;line-height:19px;">{html.escape(security_note)}</td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:19px 24px;background:#FBF6F8;border-top:1px solid #F4E8EE;">
          <p style="margin:0 0 5px;color:{BRAND_PLUM};font-size:12px;line-height:18px;font-weight:bold;">Happy Skin Nails Spa &amp; Aesthetics</p>
          <p style="margin:0;color:#8A7B84;font-size:11px;line-height:17px;">© {datetime.now().year} Happy Skin. All rights reserved.</p>
          <p style="margin:5px 0 0;color:#A09299;font-size:10px;line-height:15px;">Automated account message · Please do not reply</p>
        </td></tr>
      </table>
      <p style="margin:15px 0 0;color:#A09299;font-size:10px;line-height:16px;">This message was sent to the email address associated with your Happy Skin account.</p>
    </td></tr>
  </table>
</body>
</html>"""


def _build_message(to_email: str, full_name: str, otp: str, *, purpose: str) -> MIMEMultipart:
    if purpose == "verification":
        subject = "Verify your Happy Skin email"
        plain_intro = "Use this one-time code to verify your Happy Skin email address."
        plain_security = "If you did not create an account, ignore this message. Never share this code."
    else:
        subject = "Your Happy Skin password reset code"
        plain_intro = "Use this one-time code to continue resetting your Happy Skin password."
        plain_security = "If you did not request a password reset, ignore this message. Your password will stay the same. Never share this code."

    msg = MIMEMultipart("alternative")
    msg["Subject"] = str(Header(subject, "utf-8"))
    msg["From"] = formataddr((BRAND_NAME, settings.EMAIL_FROM))
    msg["To"] = to_email
    plain = (
        f"Happy Skin — {subject}\n\n"
        f"Hi {full_name.strip() or 'there'},\n\n{plain_intro}\n\n"
        f"Your one-time code: {otp}\n"
        f"This code expires in {settings.OTP_EXPIRE_MINUTES} minutes.\n\n"
        f"{plain_security}\n\n"
        "Happy Skin Nails Spa & Aesthetics\nAutomated account message — please do not reply."
    )
    msg.attach(MIMEText(plain, "plain", "utf-8"))
    msg.attach(MIMEText(_build_html(full_name, otp, purpose=purpose), "html", "utf-8"))
    return msg


def send_verification_email(to_email: str, full_name: str, otp: str) -> None:
    _send_email(_build_message(to_email, full_name, otp, purpose="verification"), to_email)


def send_password_reset_email(to_email: str, full_name: str, otp: str) -> None:
    _send_email(_build_message(to_email, full_name, otp, purpose="password_reset"), to_email)
