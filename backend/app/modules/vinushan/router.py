import os
from io import BytesIO
from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv

from app.schemas import PingResponse
from app.modules.vinushan.contextawareforecastingsys.api.chat_service import (
    process_chat_message,
)
from app.modules.vinushan.contextawareforecastingsys.api.realtime_streaming import (
    stream_chat_realtime,
)
from app.modules.vinushan.contextawareforecastingsys.api.models import (
    ChatRequest,
    ChatResponse,
)
from app.modules.vinushan.services import (
    EmailSettings,
    get_email_settings,
    update_email_settings,
    get_daily_summary,
    get_monthly_summary,
    get_available_date_range,
    generate_manager_report,
    generate_owner_report,
    generate_finance_report,
    generate_slack_digest,
    send_manager_report,
    send_owner_report,
    send_finance_report,
    post_to_slack_sync,
    get_all_statistics,
    get_sales_trend_data,
)

load_dotenv()


class TTSRequest(BaseModel):
    """Request model for text-to-speech."""
    text: str
    voice: str = "nova"  # Options: alloy, echo, fable, onyx, nova, shimmer

router = APIRouter()

MODULE_NAME = "vinushan"


@router.get("/ping", response_model=PingResponse)
async def ping():
    """Health check endpoint for Vinushan module."""
    return PingResponse(module=MODULE_NAME, status="ok")


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Handle chat requests using the context-aware forecasting system."""
    try:
        return process_chat_message(
            message=request.message,
            conversation_history=request.conversation_history,
        )
    except Exception as exc:  # pragma: no cover - surfaced to client
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    Handle chat requests with real-time streaming updates.
    Returns Server-Sent Events (SSE) for progressive reasoning display.
    
    Events emitted:
    - run_start: Processing begins
    - query_analysis: Routing decision with agents needed
    - agent_start: Agent beginning work
    - tool_start: Tool being invoked
    - tool_result: Tool completed with results
    - agent_output: Intermediate agent output
    - agent_end: Agent finished work
    - run_end: Complete response with all data
    - error: Error occurred
    """
    return StreamingResponse(
        stream_chat_realtime(
            message=request.message,
            conversation_history=request.conversation_history,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


# ============================================
# ADD YOUR CUSTOM ENDPOINTS BELOW THIS LINE
# ============================================


@router.post("/tts")
async def text_to_speech(request: TTSRequest):
    """
    Convert text to natural-sounding speech using OpenAI's TTS API.
    Returns audio/mpeg stream for playback.
    
    Available voices: alloy, echo, fable, onyx, nova, shimmer
    - nova: Warm, engaging female voice (default)
    - alloy: Neutral, balanced voice
    - echo: Warm male voice
    - fable: Expressive, storytelling voice
    - onyx: Deep, authoritative male voice
    - shimmer: Clear, friendly female voice
    """
    try:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        # Limit text length to avoid excessive API costs
        text = request.text[:4000] if len(request.text) > 4000 else request.text
        
        response = client.audio.speech.create(
            model="tts-1",  # Use tts-1-hd for higher quality (more expensive)
            voice=request.voice,
            input=text,
            response_format="mp3",
        )
        
        # Stream the audio response
        audio_buffer = BytesIO(response.content)
        
        return StreamingResponse(
            audio_buffer,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline",
                "Cache-Control": "no-cache",
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")


# ============================================
# EMAIL SETTINGS ENDPOINTS
# ============================================

class EmailSettingsUpdate(BaseModel):
    """Request model for updating email settings."""
    manager_email: Optional[str] = None
    owner_email: Optional[str] = None
    finance_email: Optional[str] = None
    slack_webhook_url: Optional[str] = None


@router.get("/settings/emails", response_model=EmailSettings)
async def get_settings():
    """Get saved email recipient settings."""
    return get_email_settings()


@router.put("/settings/emails", response_model=EmailSettings)
async def update_settings(settings: EmailSettingsUpdate):
    """Update email recipient settings."""
    return update_email_settings(
        manager_email=settings.manager_email,
        owner_email=settings.owner_email,
        finance_email=settings.finance_email,
        slack_webhook_url=settings.slack_webhook_url,
    )


# ============================================
# SEND REPORTS ENDPOINTS
# ============================================

class SendReportsRequest(BaseModel):
    """Request model for triggering report sending."""
    date: str  # Format: YYYY-MM-DD
    send_emails: bool = True
    send_slack: bool = True


class ReportProgress(BaseModel):
    """Model for a single progress step."""
    step: int
    label: str
    status: str  # "pending", "in_progress", "completed", "skipped", "error"
    message: Optional[str] = None


class SendReportsResponse(BaseModel):
    """Response model for send reports endpoint."""
    success: bool
    date: str
    steps: list[ReportProgress]
    summary: dict


@router.get("/reports/date-range")
async def get_data_date_range():
    """Get the available date range in the data."""
    try:
        return get_available_date_range()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/reports/send")
async def send_reports(request: SendReportsRequest):
    """
    Trigger sending reports for a specific date.
    
    Process:
    1. Fetch data for the selected date
    2. Summarize metrics
    3. Generate and send Manager email (if email configured)
    4. Generate and send Owner email (if email configured)
    5. Generate and send Finance email (if email configured)
    6. Post Slack digest (if enabled)
    
    Returns progress for each step and final status.
    """
    steps = [
        ReportProgress(step=1, label="Fetching data…", status="pending"),
        ReportProgress(step=2, label="Summarizing metrics…", status="pending"),
        ReportProgress(step=3, label="Writing email to Manager…", status="pending"),
        ReportProgress(step=4, label="Writing email to Owner…", status="pending"),
        ReportProgress(step=5, label="Writing email to Finance…", status="pending"),
        ReportProgress(step=6, label="Posting to Slack…", status="pending"),
        ReportProgress(step=7, label="Sent", status="pending"),
    ]
    
    summary = {
        "manager_email_sent": False,
        "owner_email_sent": False,
        "finance_email_sent": False,
        "slack_posted": False,
        "errors": [],
    }
    
    try:
        # Parse date
        try:
            target_date = date.fromisoformat(request.date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        # Step 1: Fetch data
        steps[0].status = "in_progress"
        try:
            daily_summary = get_daily_summary(target_date)
            steps[0].status = "completed"
            steps[0].message = f"Data loaded for {request.date}"
        except Exception as e:
            steps[0].status = "error"
            steps[0].message = str(e)
            summary["errors"].append(f"Data fetch failed: {str(e)}")
            return SendReportsResponse(success=False, date=request.date, steps=steps, summary=summary)
        
        # Step 2: Summarize metrics
        steps[1].status = "in_progress"
        try:
            monthly_summary = get_monthly_summary(target_date)
            steps[1].status = "completed"
            steps[1].message = "Metrics summarized"
        except Exception as e:
            steps[1].status = "error"
            steps[1].message = str(e)
            summary["errors"].append(f"Metrics summarization failed: {str(e)}")
            # Continue anyway with just daily data
            monthly_summary = {"has_data": False}
        
        # Get email settings
        settings = get_email_settings()
        
        # Step 3: Manager email
        if request.send_emails and settings.manager_email:
            steps[2].status = "in_progress"
            try:
                manager_content = generate_manager_report(daily_summary)
                result = send_manager_report(settings.manager_email, request.date, manager_content)
                if result["success"]:
                    steps[2].status = "completed"
                    steps[2].message = f"Sent to {settings.manager_email}"
                    summary["manager_email_sent"] = True
                else:
                    steps[2].status = "error"
                    steps[2].message = result["message"]
                    summary["errors"].append(f"Manager email: {result['message']}")
            except Exception as e:
                steps[2].status = "error"
                steps[2].message = str(e)
                summary["errors"].append(f"Manager email: {str(e)}")
        else:
            steps[2].status = "skipped"
            steps[2].message = "No manager email configured" if request.send_emails else "Emails disabled"
        
        # Step 4: Owner email
        if request.send_emails and settings.owner_email:
            steps[3].status = "in_progress"
            try:
                owner_content = generate_owner_report(daily_summary, monthly_summary)
                result = send_owner_report(settings.owner_email, request.date, owner_content)
                if result["success"]:
                    steps[3].status = "completed"
                    steps[3].message = f"Sent to {settings.owner_email}"
                    summary["owner_email_sent"] = True
                else:
                    steps[3].status = "error"
                    steps[3].message = result["message"]
                    summary["errors"].append(f"Owner email: {result['message']}")
            except Exception as e:
                steps[3].status = "error"
                steps[3].message = str(e)
                summary["errors"].append(f"Owner email: {str(e)}")
        else:
            steps[3].status = "skipped"
            steps[3].message = "No owner email configured" if request.send_emails else "Emails disabled"
        
        # Step 5: Finance email
        if request.send_emails and settings.finance_email:
            steps[4].status = "in_progress"
            try:
                finance_content = generate_finance_report(daily_summary, monthly_summary)
                result = send_finance_report(settings.finance_email, request.date, finance_content)
                if result["success"]:
                    steps[4].status = "completed"
                    steps[4].message = f"Sent to {settings.finance_email}"
                    summary["finance_email_sent"] = True
                else:
                    steps[4].status = "error"
                    steps[4].message = result["message"]
                    summary["errors"].append(f"Finance email: {result['message']}")
            except Exception as e:
                steps[4].status = "error"
                steps[4].message = str(e)
                summary["errors"].append(f"Finance email: {str(e)}")
        else:
            steps[4].status = "skipped"
            steps[4].message = "No finance email configured" if request.send_emails else "Emails disabled"
        
        # Step 6: Slack
        if request.send_slack:
            steps[5].status = "in_progress"
            try:
                slack_message = generate_slack_digest(daily_summary)
                result = post_to_slack_sync(slack_message, settings.slack_webhook_url)
                if result["success"]:
                    steps[5].status = "completed"
                    steps[5].message = "Posted to Slack"
                    summary["slack_posted"] = True
                else:
                    steps[5].status = "error"
                    steps[5].message = result["message"]
                    summary["errors"].append(f"Slack: {result['message']}")
            except Exception as e:
                steps[5].status = "error"
                steps[5].message = str(e)
                summary["errors"].append(f"Slack: {str(e)}")
        else:
            steps[5].status = "skipped"
            steps[5].message = "Slack updates disabled"
        
        # Step 7: Done
        has_errors = len(summary["errors"]) > 0
        steps[6].status = "completed" if not has_errors else "completed"
        steps[6].message = "All reports sent!" if not has_errors else f"Completed with {len(summary['errors'])} error(s)"
        
        return SendReportsResponse(
            success=not has_errors or (summary["manager_email_sent"] or summary["owner_email_sent"] or 
                                       summary["finance_email_sent"] or summary["slack_posted"]),
            date=request.date,
            steps=steps,
            summary=summary,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report sending failed: {str(e)}")


@router.get("/reports/preview/{date_str}")
async def preview_report_data(date_str: str):
    """
    Preview the data that would be used for reports on a specific date.
    Useful for testing without actually sending emails.
    """
    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    try:
        daily_summary = get_daily_summary(target_date)
        monthly_summary = get_monthly_summary(target_date)
        slack_preview = generate_slack_digest(daily_summary)
        
        return {
            "date": date_str,
            "daily_summary": daily_summary,
            "monthly_summary": monthly_summary,
            "slack_preview": slack_preview,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# STATISTICS ENDPOINTS
# ============================================

@router.get("/statistics")
async def get_statistics():
    """
    Get comprehensive statistics for the dashboard.
    Includes overview, trends, products, calendar patterns, weather impact, etc.
    """
    try:
        return get_all_statistics()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get statistics: {str(e)}")


@router.get("/statistics/trend/{period}")
async def get_trend_statistics(period: str, limit: int = 60):
    """
    Get sales trend data for a specific period.
    
    Args:
        period: 'daily', 'weekly', or 'monthly'
        limit: Number of periods to return (default 60)
    """
    if period not in ['daily', 'weekly', 'monthly']:
        raise HTTPException(status_code=400, detail="Period must be 'daily', 'weekly', or 'monthly'")
    
    try:
        return get_sales_trend_data(period=period, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# WEATHER & HOLIDAYS ENDPOINTS
# ============================================

import httpx

@router.get("/weather/{location}")
async def get_weather(location: str):
    """
    Get real-time weather data for a location using Open-Meteo API (free, no API key needed).
    
    Args:
        location: City name (e.g., 'Katunayake')
    """
    try:
        # Coordinates for Katunayake, Sri Lanka
        location_coords = {
            "Katunayake": {"lat": 7.1681, "lon": 79.8842},
            "Colombo": {"lat": 6.9271, "lon": 79.8612},
        }
        
        coords = location_coords.get(location, location_coords["Katunayake"])
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Current weather
            current_url = (
                f"https://api.open-meteo.com/v1/forecast"
                f"?latitude={coords['lat']}&longitude={coords['lon']}"
                f"&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m"
                f"&daily=weather_code,temperature_2m_max,temperature_2m_min"
                f"&timezone=Asia/Colombo&forecast_days=7"
            )
            
            response = await client.get(current_url)
            response.raise_for_status()
            data = response.json()
            
            # Map weather codes to conditions
            weather_codes = {
                0: "Clear", 1: "Mostly Clear", 2: "Partly Cloudy", 3: "Cloudy",
                45: "Fog", 48: "Fog", 51: "Drizzle", 53: "Drizzle", 55: "Drizzle",
                61: "Rain", 63: "Rain", 65: "Heavy Rain",
                71: "Snow", 73: "Snow", 75: "Heavy Snow",
                80: "Rain Showers", 81: "Rain Showers", 82: "Heavy Showers",
                95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm"
            }
            
            current = data.get("current", {})
            daily = data.get("daily", {})
            
            # Build forecast
            forecast = []
            if daily.get("time"):
                day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                for i in range(min(7, len(daily["time"]))):
                    from datetime import datetime
                    date_obj = datetime.strptime(daily["time"][i], "%Y-%m-%d")
                    forecast.append({
                        "day": day_names[date_obj.weekday()],
                        "date": daily["time"][i],
                        "temp_high": round(daily["temperature_2m_max"][i]),
                        "temp_low": round(daily["temperature_2m_min"][i]),
                        "condition": weather_codes.get(daily["weather_code"][i], "Clear")
                    })
            
            return {
                "location": location,
                "current": {
                    "temperature": round(current.get("temperature_2m", 28)),
                    "humidity": round(current.get("relative_humidity_2m", 75)),
                    "wind_speed": round(current.get("wind_speed_10m", 12)),
                    "condition": weather_codes.get(current.get("weather_code", 0), "Clear"),
                    "visibility": 10
                },
                "forecast": forecast
            }
            
    except Exception as e:
        # Return fallback data if API fails
        return {
            "location": location,
            "current": {
                "temperature": 28,
                "humidity": 75,
                "wind_speed": 12,
                "condition": "Partly Cloudy",
                "visibility": 10
            },
            "forecast": [
                {"day": "Mon", "temp_high": 31, "temp_low": 24, "condition": "Clouds"},
                {"day": "Tue", "temp_high": 30, "temp_low": 23, "condition": "Rain"},
                {"day": "Wed", "temp_high": 29, "temp_low": 24, "condition": "Clouds"},
                {"day": "Thu", "temp_high": 31, "temp_low": 25, "condition": "Clear"},
                {"day": "Fri", "temp_high": 30, "temp_low": 24, "condition": "Rain"},
            ],
            "error": str(e)
        }


@router.get("/holidays/{year}")
async def get_holidays(year: int):
    """
    Get Sri Lankan public holidays for a given year.
    
    Args:
        year: The year (e.g., 2026)
    """
    # Sri Lankan public holidays - comprehensive list
    holidays_data = {
        2025: [
            {"date": "2025-01-14", "name": "Thai Pongal", "type": "Public Holiday"},
            {"date": "2025-01-15", "name": "Duruthu Full Moon Poya", "type": "Poya Day"},
            {"date": "2025-02-04", "name": "Independence Day", "type": "National Day"},
            {"date": "2025-02-12", "name": "Nawam Full Moon Poya", "type": "Poya Day"},
            {"date": "2025-02-26", "name": "Maha Shivaratri", "type": "Hindu Holiday"},
            {"date": "2025-03-13", "name": "Medin Full Moon Poya", "type": "Poya Day"},
            {"date": "2025-03-30", "name": "Eid ul-Fitr", "type": "Muslim Holiday"},
            {"date": "2025-04-12", "name": "Bak Full Moon Poya", "type": "Poya Day"},
            {"date": "2025-04-13", "name": "Sinhala & Tamil New Year Eve", "type": "National Holiday"},
            {"date": "2025-04-14", "name": "Sinhala & Tamil New Year", "type": "National Holiday"},
            {"date": "2025-04-18", "name": "Good Friday", "type": "Christian Holiday"},
            {"date": "2025-05-01", "name": "May Day", "type": "Public Holiday"},
            {"date": "2025-05-11", "name": "Vesak Full Moon Poya", "type": "Poya Day"},
            {"date": "2025-05-12", "name": "Day after Vesak", "type": "Poya Day"},
            {"date": "2025-06-06", "name": "Eid ul-Adha", "type": "Muslim Holiday"},
            {"date": "2025-06-09", "name": "Poson Full Moon Poya", "type": "Poya Day"},
            {"date": "2025-07-09", "name": "Esala Full Moon Poya", "type": "Poya Day"},
            {"date": "2025-08-07", "name": "Nikini Full Moon Poya", "type": "Poya Day"},
            {"date": "2025-09-05", "name": "Binara Full Moon Poya", "type": "Poya Day"},
            {"date": "2025-10-05", "name": "Vap Full Moon Poya", "type": "Poya Day"},
            {"date": "2025-10-20", "name": "Deepavali", "type": "Hindu Holiday"},
            {"date": "2025-11-04", "name": "Il Full Moon Poya", "type": "Poya Day"},
            {"date": "2025-12-04", "name": "Unduvap Full Moon Poya", "type": "Poya Day"},
            {"date": "2025-12-25", "name": "Christmas Day", "type": "Christian Holiday"},
        ],
        2026: [
            {"date": "2026-01-03", "name": "Duruthu Full Moon Poya", "type": "Poya Day"},
            {"date": "2026-01-14", "name": "Thai Pongal", "type": "Public Holiday"},
            {"date": "2026-02-01", "name": "Nawam Full Moon Poya", "type": "Poya Day"},
            {"date": "2026-02-04", "name": "Independence Day", "type": "National Day"},
            {"date": "2026-02-15", "name": "Maha Shivaratri", "type": "Hindu Holiday"},
            {"date": "2026-03-03", "name": "Medin Full Moon Poya", "type": "Poya Day"},
            {"date": "2026-03-20", "name": "Eid ul-Fitr", "type": "Muslim Holiday"},
            {"date": "2026-04-01", "name": "Bak Full Moon Poya", "type": "Poya Day"},
            {"date": "2026-04-03", "name": "Good Friday", "type": "Christian Holiday"},
            {"date": "2026-04-13", "name": "Sinhala & Tamil New Year Eve", "type": "National Holiday"},
            {"date": "2026-04-14", "name": "Sinhala & Tamil New Year", "type": "National Holiday"},
            {"date": "2026-05-01", "name": "May Day", "type": "Public Holiday"},
            {"date": "2026-05-01", "name": "Vesak Full Moon Poya", "type": "Poya Day"},
            {"date": "2026-05-02", "name": "Day after Vesak", "type": "Poya Day"},
            {"date": "2026-05-27", "name": "Eid ul-Adha", "type": "Muslim Holiday"},
            {"date": "2026-05-30", "name": "Poson Full Moon Poya", "type": "Poya Day"},
            {"date": "2026-06-29", "name": "Esala Full Moon Poya", "type": "Poya Day"},
            {"date": "2026-07-28", "name": "Nikini Full Moon Poya", "type": "Poya Day"},
            {"date": "2026-08-26", "name": "Binara Full Moon Poya", "type": "Poya Day"},
            {"date": "2026-09-25", "name": "Vap Full Moon Poya", "type": "Poya Day"},
            {"date": "2026-10-24", "name": "Il Full Moon Poya", "type": "Poya Day"},
            {"date": "2026-11-08", "name": "Deepavali", "type": "Hindu Holiday"},
            {"date": "2026-11-22", "name": "Unduvap Full Moon Poya", "type": "Poya Day"},
            {"date": "2026-12-22", "name": "Unduvap Full Moon Poya", "type": "Poya Day"},
            {"date": "2026-12-25", "name": "Christmas Day", "type": "Christian Holiday"},
        ]
    }
    
    holidays = holidays_data.get(year, holidays_data.get(2026, []))
    
    return {
        "year": year,
        "country": "Sri Lanka",
        "holidays": holidays
    }

