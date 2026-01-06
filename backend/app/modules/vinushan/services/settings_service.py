"""
Settings Service
================
Manages persistent storage of email settings for report recipients.
Uses a simple JSON file for storage.
"""

import json
import os
from typing import Optional
from pydantic import BaseModel, EmailStr

# Path to settings file
SETTINGS_DIR = os.path.dirname(os.path.abspath(__file__))
SETTINGS_FILE = os.path.join(SETTINGS_DIR, "email_settings.json")


class EmailSettings(BaseModel):
    """Model for email recipient settings."""
    manager_email: Optional[str] = None
    owner_email: Optional[str] = None
    finance_email: Optional[str] = None
    slack_webhook_url: Optional[str] = None


def get_email_settings() -> EmailSettings:
    """Load email settings from file."""
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                data = json.load(f)
                return EmailSettings(**data)
        except (json.JSONDecodeError, Exception):
            pass
    return EmailSettings()


def save_email_settings(settings: EmailSettings) -> EmailSettings:
    """Save email settings to file."""
    with open(SETTINGS_FILE, "w") as f:
        json.dump(settings.model_dump(), f, indent=2)
    return settings


def update_email_settings(
    manager_email: Optional[str] = None,
    owner_email: Optional[str] = None,
    finance_email: Optional[str] = None,
    slack_webhook_url: Optional[str] = None,
) -> EmailSettings:
    """Update specific email settings."""
    current = get_email_settings()
    
    if manager_email is not None:
        current.manager_email = manager_email if manager_email.strip() else None
    if owner_email is not None:
        current.owner_email = owner_email if owner_email.strip() else None
    if finance_email is not None:
        current.finance_email = finance_email if finance_email.strip() else None
    if slack_webhook_url is not None:
        current.slack_webhook_url = slack_webhook_url if slack_webhook_url.strip() else None
    
    return save_email_settings(current)
