"""
Slack Service
=============
Posts messages to Slack channels using webhooks.
"""

import os
import httpx
from typing import Optional
from dotenv import load_dotenv

load_dotenv()


def get_slack_webhook_url() -> Optional[str]:
    """Get Slack webhook URL from environment or settings."""
    return os.getenv("SLACK_WEBHOOK_URL")


async def post_to_slack(message: str, webhook_url: Optional[str] = None) -> dict:
    """
    Post a message to Slack using a webhook.
    
    Args:
        message: The message to post (supports Slack markdown)
        webhook_url: Optional webhook URL (uses env var if not provided)
    
    Returns:
        dict with 'success' boolean and 'message' string
    """
    url = webhook_url or get_slack_webhook_url()
    
    if not url:
        # For development/demo, just return success without actually posting
        return {
            "success": True,
            "message": "Slack message would be posted (webhook not configured)",
            "demo_mode": True,
        }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json={"text": message},
                headers={"Content-Type": "application/json"},
            )
            
            if response.status_code == 200:
                return {
                    "success": True,
                    "message": "Message posted to Slack successfully",
                }
            else:
                return {
                    "success": False,
                    "message": f"Slack API error: {response.status_code} - {response.text}",
                }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to post to Slack: {str(e)}",
        }


def post_to_slack_sync(message: str, webhook_url: Optional[str] = None) -> dict:
    """
    Synchronous version of post_to_slack.
    """
    import httpx
    
    url = webhook_url or get_slack_webhook_url()
    
    if not url:
        return {
            "success": True,
            "message": "Slack message would be posted (webhook not configured)",
            "demo_mode": True,
        }
    
    try:
        with httpx.Client() as client:
            response = client.post(
                url,
                json={"text": message},
                headers={"Content-Type": "application/json"},
            )
            
            if response.status_code == 200:
                return {
                    "success": True,
                    "message": "Message posted to Slack successfully",
                }
            else:
                return {
                    "success": False,
                    "message": f"Slack API error: {response.status_code} - {response.text}",
                }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to post to Slack: {str(e)}",
        }
