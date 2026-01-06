"""
Services module for Vinushan's ATHENA system.
Contains email, slack, settings, data, and report generation services.
"""

from .settings_service import (
    EmailSettings,
    get_email_settings,
    save_email_settings,
    update_email_settings,
)
from .data_service import (
    get_daily_summary,
    get_monthly_summary,
    get_available_date_range,
)
from .report_generator import (
    generate_manager_report,
    generate_owner_report,
    generate_finance_report,
    generate_slack_digest,
)
from .email_service import (
    send_email,
    send_manager_report,
    send_owner_report,
    send_finance_report,
)
from .slack_service import (
    post_to_slack,
    post_to_slack_sync,
)
from .statistics_service import (
    get_overview_statistics,
    get_sales_trend_data,
    get_product_statistics,
    get_order_type_statistics,
    get_calendar_statistics,
    get_weather_statistics,
    get_holiday_statistics,
    get_forecast_comparison,
    get_discount_analysis,
    get_all_statistics,
)

__all__ = [
    "EmailSettings",
    "get_email_settings",
    "save_email_settings",
    "update_email_settings",
    "get_daily_summary",
    "get_monthly_summary",
    "get_available_date_range",
    "generate_manager_report",
    "generate_owner_report",
    "generate_finance_report",
    "generate_slack_digest",
    "send_email",
    "send_manager_report",
    "send_owner_report",
    "send_finance_report",
    "post_to_slack",
    "post_to_slack_sync",
    "get_overview_statistics",
    "get_sales_trend_data",
    "get_product_statistics",
    "get_order_type_statistics",
    "get_calendar_statistics",
    "get_weather_statistics",
    "get_holiday_statistics",
    "get_forecast_comparison",
    "get_discount_analysis",
    "get_all_statistics",
]
