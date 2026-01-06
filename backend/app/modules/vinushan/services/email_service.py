"""
Email Service
=============
Sends emails using SMTP.
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from dotenv import load_dotenv

load_dotenv()


def get_smtp_config():
    """Get SMTP configuration from environment variables."""
    return {
        "host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.getenv("SMTP_PORT", "587")),
        "username": os.getenv("SMTP_USERNAME", ""),
        "password": os.getenv("SMTP_PASSWORD", ""),
        "from_email": os.getenv("SMTP_FROM_EMAIL", os.getenv("SMTP_USERNAME", "")),
        "from_name": os.getenv("SMTP_FROM_NAME", "ATHENA Reports"),
    }


def send_email(
    to_email: str,
    subject: str,
    body: str,
    is_html: bool = False,
) -> dict:
    """
    Send an email using SMTP.
    
    Returns:
        dict with 'success' boolean and 'message' string
    """
    config = get_smtp_config()
    
    if not config["username"] or not config["password"]:
        # For development/demo, just return success without actually sending
        return {
            "success": True,
            "message": f"Email would be sent to {to_email} (SMTP not configured)",
            "demo_mode": True,
        }
    
    try:
        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{config['from_name']} <{config['from_email']}>"
        msg["To"] = to_email
        
        # Attach body
        if is_html:
            msg.attach(MIMEText(body, "html"))
        else:
            msg.attach(MIMEText(body, "plain"))
        
        # Send email
        with smtplib.SMTP(config["host"], config["port"]) as server:
            server.starttls()
            server.login(config["username"], config["password"])
            server.send_message(msg)
        
        return {
            "success": True,
            "message": f"Email sent successfully to {to_email}",
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to send email: {str(e)}",
        }


def send_manager_report(to_email: str, date: str, content: str) -> dict:
    """Send Manager report email."""
    subject = f"☕ Daily Sales Snapshot - {date}"
    return send_email(to_email, subject, content)


def send_owner_report(to_email: str, date: str, content: str) -> dict:
    """Send Owner report email."""
    subject = f"📊 Monthly Business Overview - {date}"
    return send_email(to_email, subject, content)


def send_finance_report(to_email: str, date: str, content: str) -> dict:
    """Send Finance report email."""
    subject = f"💰 Financial Summary - {date}"
    return send_email(to_email, subject, content)
