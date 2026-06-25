import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings


def _build_html(full_name: str, otp: str) -> str:
    digits = "".join(f'<div style="width:44px;height:52px;background:#fff;border-radius:10px;border:1.5px solid #e8a0c8;display:inline-flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;color:#C85B95;margin:0 5px;">{d}</div>' for d in otp)
    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F8E5EE;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #ecd5e3;">
    <div style="background:linear-gradient(160deg,#f9d6e8 0%,#f0a8cc 50%,#e07ab0 100%);padding:44px 32px 36px;text-align:center;">
      <div style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.25);border:2px solid rgba(255,255,255,0.5);margin:0 auto 14px;display:inline-flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#fff;">HS</div>
      <p style="color:#fff;font-size:22px;font-weight:700;margin:0 0 4px;">Happy Skin</p>
      <p style="color:rgba(255,255,255,0.85);font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0;">Nails Spa &amp; Aesthetics</p>
    </div>
    <div style="padding:40px 36px;background:#fff;">
      <p style="font-size:17px;font-weight:600;color:#2D2D2D;margin:0 0 10px;">Hello, {full_name}! 👋</p>
      <p style="font-size:14px;color:#6B3F5D;line-height:1.7;margin:0 0 30px;">Welcome to Happy Skin! We're thrilled to have you.<br/>Use the code below to verify your email address and get started.</p>
      <div style="background:#FDF2F7;border-radius:16px;border:1.5px dashed #e8a0c8;padding:28px 24px;text-align:center;margin-bottom:28px;">
        <p style="font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#b06090;margin:0 0 14px;font-weight:600;">Your verification code</p>
        <div>{digits}</div>
        <p style="font-size:12px;color:#b06090;margin:14px 0 0;">⏰ Expires in <strong>10 minutes</strong></p>
      </div>
      <div style="height:1px;background:#f3e0ec;margin:0 0 24px;"></div>
      <p style="font-size:12.5px;color:#b06090;line-height:1.6;margin:0;padding:14px 16px;background:#fdf7fa;border-radius:10px;border-left:3px solid #e8a0c8;">If you didn't create an account with Happy Skin, you can safely ignore this email. Please do not share this code with anyone.</p>
    </div>
    <div style="background:#fdf2f7;padding:20px 32px;text-align:center;">
      <p style="font-size:18px;margin:0 0 6px;">🌸 🌷 🌸</p>
      <p style="font-size:13px;font-weight:700;color:#C85B95;margin:0 0 4px;">Happy Skin Nails Spa &amp; Aesthetics</p>
      <p style="font-size:11px;color:#b06090;margin:0;line-height:1.6;">© 2026 Happy Skin. All rights reserved.<br/>This is an automated message — please do not reply.</p>
    </div>
  </div>
</body></html>"""


def send_verification_email(to_email: str, full_name: str, otp: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Happy Skin – Email Verification Code"
    msg["From"]    = f"Happy Skin <{settings.EMAIL_FROM}>"
    msg["To"]      = to_email

    text_part = MIMEText(
        f"Hello {full_name},\n\nYour Happy Skin verification code is: {otp}\n"
        f"It expires in 10 minutes.\n\nIf you didn't register, ignore this email.",
        "plain",
    )
    html_part = MIMEText(_build_html(full_name, otp), "html")

    msg.attach(text_part)
    msg.attach(html_part)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.sendmail(settings.EMAIL_FROM, to_email, msg.as_string())
