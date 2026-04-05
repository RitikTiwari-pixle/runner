"""
Email Service

Sends transactional auth emails (OTP verification and password reset)
using SMTP configuration from environment variables.
"""

import asyncio
import logging
import os
import smtplib
from email.message import EmailMessage

logger = logging.getLogger(__name__)


def _build_html_template(app_name: str, purpose: str, code: str, expires_minutes: int) -> str:
    """Build professional HTML email template"""
    
    if purpose == "password_reset":
        title = "Reset Your Password"
        description = "You requested to reset your password for Territory Runner. Use the code below to proceed."
        button_text = "Reset Password"
    else:
        title = "Verify Your Email"
        description = "Welcome! Please verify your email address to complete your Territory Runner account setup."
        button_text = "Verify Email"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }}
            .email-container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
            .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white; }}
            .header h1 {{ margin: 0; font-size: 28px; font-weight: 600; }}
            .content {{ padding: 40px 30px; }}
            .content h2 {{ color: #333; font-size: 20px; margin-bottom: 10px; }}
            .description {{ color: #666; font-size: 14px; line-height: 1.8; margin-bottom: 30px; }}
            .code-box {{ background: #f5f5f5; border-left: 4px solid #667eea; padding: 15px 20px; margin: 25px 0; border-radius: 4px; }}
            .code {{ font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #667eea; text-align: center; font-family: 'Courier New', monospace; }}
            .info {{ color: #999; font-size: 12px; margin: 20px 0; line-height: 1.6; }}
            .footer {{ background: #f9f9f9; padding: 20px 30px; text-align: center; border-top: 1px solid #eee; color: #999; font-size: 12px; }}
            .warning {{ background: #fff3cd; border: 1px solid #ffc107; padding: 12px 15px; border-radius: 4px; color: #856404; font-size: 13px; margin-top: 20px; }}
            .divider {{ height: 2px; background: #f0f0f0; margin: 20px 0; }}
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <h1>{app_name}</h1>
            </div>
            
            <div class="content">
                <h2>{title}</h2>
                
                <p class="description">{description}</p>
                
                <div class="code-box">
                    <p style="margin: 0 0 10px 0; color: #999; font-size: 12px; text-transform: uppercase;">Your Verification Code</p>
                    <div class="code">{code}</div>
                </div>
                
                <div class="info">
                    <strong>Code expires in:</strong> {expires_minutes} minutes<br>
                    <strong>Time-sensitive:</strong> This code is only valid for {expires_minutes} minutes for your account security.
                </div>
                
                <div class="warning">
                    <strong>⚠️ Security Notice:</strong> Never share this code with anyone. {app_name} will never ask for this code via phone, email, or any other channel.
                </div>
                
                <div class="divider"></div>
                
                <p style="color: #666; font-size: 13px; margin: 20px 0;">
                    If you didn't request this code, please ignore this email or 
                    <a href="#" style="color: #667eea; text-decoration: none;">contact support</a> 
                    if you believe your account has been compromised.
                </p>
            </div>
            
            <div class="footer">
                <p style="margin: 0;">Territory Runner © 2026 | All Rights Reserved</p>
                <p style="margin: 5px 0 0 0;">This is an automated message, please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
    """
    return html


def _build_message(recipient: str, code: str, purpose: str, expires_minutes: int) -> EmailMessage:
    app_name = os.getenv("APP_NAME", "Territory Runner")
    sender_email = os.getenv("SMTP_FROM_EMAIL", "noreply@territoryrunner.local")
    sender_name = os.getenv("SMTP_FROM_NAME", "Territory Runner")
    sender = f"{sender_name} <{sender_email}>"

    if purpose == "password_reset":
        subject = f"🔐 Password Reset Code - {app_name}"
    else:
        subject = f"✉️ Email Verification - {app_name}"

    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = recipient
    msg["Reply-To"] = sender_email
    msg["Subject"] = subject
    
    # HTML content
    html_content = _build_html_template(app_name, purpose, code, expires_minutes)
    msg.add_alternative(html_content, subtype="html")
    
    # Plain text fallback
    if purpose == "password_reset":
        intro = "Use this one-time code to reset your password."
    else:
        intro = "Use this one-time code to verify your account."
    
    plain_text = (
        f"{intro}\n\n"
        f"Code: {code}\n"
        f"Expires in: {expires_minutes} minutes\n\n"
        f"If you did not request this, ignore this email.\n\n"
        f"Do not share this code with anyone."
    )
    msg.set_content(plain_text)
    
    return msg


def _send_via_smtp(message: EmailMessage) -> None:
    host = os.getenv("SMTP_HOST")
    if not host:
        raise RuntimeError("SMTP_HOST is not configured")

    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    # 10 s timeout ensures we fail before the 15 s axios client timeout.
    with smtplib.SMTP(host, port, timeout=10) as server:
        if use_tls:
            server.starttls()
        if username:
            server.login(username, password or "")
        server.send_message(message)


async def send_otp_email(recipient: str, code: str, purpose: str, expires_minutes: int) -> bool:
    """
    Sends OTP email. Returns True on success.
    Returns False when SMTP is not configured or sending fails.
    Retries once after 2 s to handle transient SMTP blips.
    """
    message = _build_message(recipient, code, purpose, expires_minutes)
    last_exc: Exception | None = None
    for attempt in range(2):
        try:
            await asyncio.to_thread(_send_via_smtp, message)
            return True
        except Exception as exc:
            last_exc = exc
            logger.warning("[Email] OTP send attempt %d failed for %s: %s", attempt + 1, recipient, exc)
            if attempt == 0:
                await asyncio.sleep(2)
    logger.error("[Email] All OTP send attempts failed for %s: %s", recipient, last_exc)
    return False
