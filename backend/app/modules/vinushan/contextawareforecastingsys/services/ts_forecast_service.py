"""
Time Series Forecast Service - Unified forecasting interface.
Provides forecast_daily_qty() function for Prophet model predictions.
"""

import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

import pandas as pd
import numpy as np

from .ts_model_registry import get_model_registry
from .. import DATA_DIR


# Historical weather averages by month (Katunayake / Negombo, Sri Lanka)
# Based on actual data from the training dataset
MONTHLY_WEATHER_DEFAULTS = {
    1: {"temp_avg": 27.5, "rain_mm": 1.2, "is_rainy": 0.3},   # January
    2: {"temp_avg": 28.2, "rain_mm": 0.8, "is_rainy": 0.2},   # February
    3: {"temp_avg": 29.5, "rain_mm": 1.5, "is_rainy": 0.25},  # March
    4: {"temp_avg": 30.2, "rain_mm": 4.5, "is_rainy": 0.45},  # April
    5: {"temp_avg": 29.8, "rain_mm": 8.2, "is_rainy": 0.55},  # May (monsoon starts)
    6: {"temp_avg": 28.5, "rain_mm": 6.5, "is_rainy": 0.5},   # June
    7: {"temp_avg": 28.0, "rain_mm": 5.0, "is_rainy": 0.45},  # July
    8: {"temp_avg": 28.2, "rain_mm": 4.8, "is_rainy": 0.42},  # August
    9: {"temp_avg": 28.5, "rain_mm": 5.5, "is_rainy": 0.48},  # September
    10: {"temp_avg": 28.0, "rain_mm": 8.0, "is_rainy": 0.6},  # October (NE monsoon)
    11: {"temp_avg": 27.8, "rain_mm": 6.5, "is_rainy": 0.55}, # November
    12: {"temp_avg": 27.2, "rain_mm": 3.0, "is_rainy": 0.35}, # December
}


def _load_holiday_data() -> pd.DataFrame:
    """Load the holiday calendar for Sri Lanka."""
    holiday_path = DATA_DIR / "processed" / "prophet_holidays.csv"
    if holiday_path.exists():
        df = pd.read_csv(holiday_path)
        df['ds'] = pd.to_datetime(df['ds'])
        return df
    return pd.DataFrame(columns=['ds', 'holiday'])


def _get_holiday_flags(date: datetime, holidays_df: pd.DataFrame) -> Dict[str, int]:
    """
    Determine holiday flags for a given date.
    Returns is_holiday, is_pre_holiday, is_post_holiday flags.
    """
    date_only = pd.Timestamp(date.date())
    prev_day = date_only - pd.Timedelta(days=1)
    next_day = date_only + pd.Timedelta(days=1)
    
    is_holiday = int(date_only in holidays_df['ds'].values)
    is_pre_holiday = int(next_day in holidays_df['ds'].values)
    is_post_holiday = int(prev_day in holidays_df['ds'].values)
    
    return {
        "is_holiday": is_holiday,
        "is_pre_holiday": is_pre_holiday,
        "is_post_holiday": is_post_holiday,
    }


def _build_future_dataframe(
    start_date: datetime,
    end_date: datetime,
    context_overrides: Optional[Dict[str, Any]] = None,
) -> pd.DataFrame:
    """
    Build a future dataframe with all required regressors for Prophet.
    
    Args:
        start_date: Start date for forecast
        end_date: End date for forecast
        context_overrides: Optional dict to override weather/context values
            e.g., {"rain_mm": 10, "is_rainy": 1} for simulating a rainy week
    """
    # Generate date range
    dates = pd.date_range(start=start_date, end=end_date, freq='D')
    
    # Load holiday data
    holidays_df = _load_holiday_data()
    
    # Build future dataframe
    future_rows = []
    
    for date in dates:
        month = date.month
        weather_defaults = MONTHLY_WEATHER_DEFAULTS.get(month, {
            "temp_avg": 28.0,
            "rain_mm": 3.0,
            "is_rainy": 0.35,
        })
        
        # Get holiday flags
        holiday_flags = _get_holiday_flags(date, holidays_df)
        
        # Build row with all regressors
        row = {
            "ds": date,
            "is_weekend": 1 if date.weekday() >= 5 else 0,
            "is_holiday": holiday_flags["is_holiday"],
            "is_pre_holiday": holiday_flags["is_pre_holiday"],
            "is_post_holiday": holiday_flags["is_post_holiday"],
            "temp_avg": weather_defaults["temp_avg"],
            "rain_mm": weather_defaults["rain_mm"],
            "is_rainy": 1 if weather_defaults["is_rainy"] > 0.5 else 0,
        }
        
        # Apply context overrides if provided
        if context_overrides:
            for key, value in context_overrides.items():
                if key in row:
                    row[key] = value
        
        future_rows.append(row)
    
    return pd.DataFrame(future_rows)


def _identify_busiest_days(predictions: List[Dict], top_n: int = 5) -> List[str]:
    """Identify the busiest days from predictions."""
    sorted_preds = sorted(predictions, key=lambda x: x["yhat"], reverse=True)
    return [p["date"] for p in sorted_preds[:top_n]]


def _generate_uncertainty_note(predictions: List[Dict]) -> str:
    """Generate a note about prediction uncertainty."""
    if not predictions:
        return "No predictions available."
    
    avg_yhat = np.mean([p["yhat"] for p in predictions])
    avg_range = np.mean([p["yhat_upper"] - p["yhat_lower"] for p in predictions])
    uncertainty_pct = (avg_range / avg_yhat * 100) if avg_yhat > 0 else 0
    
    if uncertainty_pct < 50:
        return "Predictions have moderate confidence. Actual values likely within predicted range."
    elif uncertainty_pct < 100:
        return "Predictions have wider confidence intervals. Consider buffer stock for variability."
    else:
        return "High uncertainty in predictions. Use as directional guidance, not exact targets."


def forecast_daily_qty(
    horizon_days: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    context_overrides: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Generate daily quantity forecast using the trained Prophet model.
    
    Args:
        horizon_days: Number of days to forecast from today (if start/end not provided)
        start_date: Start date for forecast (YYYY-MM-DD format)
        end_date: End date for forecast (YYYY-MM-DD format)
        context_overrides: Optional dict to override default weather/context values
            Examples:
            - {"rain_mm": 15, "is_rainy": 1} for simulating rainy conditions
            - {"temp_avg": 32} for simulating hot weather
    
    Returns:
        Dictionary with:
        - model: Model identifier
        - target: Target variable name
        - predictions: List of daily predictions with date, yhat, yhat_lower, yhat_upper
        - summary: Summary statistics including total_qty, busiest_days, uncertainty_note
    """
    registry = get_model_registry()
    
    # Check if model is loaded
    if not registry.is_loaded:
        return {
            "model": "prophet",
            "target": "daily_total_qty",
            "error": "Prophet model not loaded. Please ensure the model file exists.",
            "predictions": [],
            "summary": {
                "total_qty": 0,
                "busiest_days": [],
                "uncertainty_note": "Model not available.",
            }
        }
    
    # Determine date range
    today = datetime.now()
    
    if start_date and end_date:
        forecast_start = datetime.strptime(start_date, "%Y-%m-%d")
        forecast_end = datetime.strptime(end_date, "%Y-%m-%d")
    elif horizon_days:
        forecast_start = today + timedelta(days=1)
        forecast_end = forecast_start + timedelta(days=horizon_days - 1)
    else:
        # Default: forecast next 30 days
        forecast_start = today + timedelta(days=1)
        forecast_end = forecast_start + timedelta(days=29)
    
    # Build future dataframe with regressors
    future_df = _build_future_dataframe(
        start_date=forecast_start,
        end_date=forecast_end,
        context_overrides=context_overrides,
    )
    
    # Make predictions
    try:
        forecast = registry.model.predict(future_df)
        
        # Extract predictions
        predictions = []
        for _, row in forecast.iterrows():
            predictions.append({
                "date": row['ds'].strftime("%Y-%m-%d"),
                "yhat": round(max(0, row['yhat']), 2),  # Ensure non-negative
                "yhat_lower": round(max(0, row['yhat_lower']), 2),
                "yhat_upper": round(row['yhat_upper'], 2),
                "day_of_week": row['ds'].strftime("%A"),
            })
        
        # Calculate summary
        total_qty = sum(p["yhat"] for p in predictions)
        busiest_days = _identify_busiest_days(predictions, top_n=5)
        uncertainty_note = _generate_uncertainty_note(predictions)
        
        return {
            "model": f"prophet_{registry.model_version}",
            "target": registry.target,
            "forecast_period": {
                "start": forecast_start.strftime("%Y-%m-%d"),
                "end": forecast_end.strftime("%Y-%m-%d"),
                "days": len(predictions),
            },
            "model_metrics": registry.metrics,
            "context_applied": context_overrides or {},
            "predictions": predictions,
            "summary": {
                "total_qty": round(total_qty, 2),
                "avg_daily_qty": round(total_qty / len(predictions), 2) if predictions else 0,
                "busiest_days": busiest_days,
                "uncertainty_note": uncertainty_note,
            }
        }
        
    except Exception as e:
        return {
            "model": "prophet",
            "target": "daily_total_qty",
            "error": f"Forecast generation failed: {str(e)}",
            "predictions": [],
            "summary": {
                "total_qty": 0,
                "busiest_days": [],
                "uncertainty_note": f"Error during forecasting: {str(e)}",
            }
        }


def get_forecast_for_month(
    year: int,
    month: int,
    context_overrides: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Convenience function to forecast for a specific month.
    
    Args:
        year: Target year
        month: Target month (1-12)
        context_overrides: Optional weather/context overrides
    """
    from calendar import monthrange
    
    start_date = f"{year}-{month:02d}-01"
    _, last_day = monthrange(year, month)
    end_date = f"{year}-{month:02d}-{last_day:02d}"
    
    return forecast_daily_qty(
        start_date=start_date,
        end_date=end_date,
        context_overrides=context_overrides,
    )


def get_what_if_forecast(
    horizon_days: int = 14,
    scenario: str = "normal",
) -> Dict[str, Any]:
    """
    Generate what-if scenario forecasts.
    
    Args:
        horizon_days: Number of days to forecast
        scenario: One of "normal", "rainy_week", "hot_week", "holiday_surge"
    """
    scenarios = {
        "normal": None,
        "rainy_week": {"rain_mm": 12, "is_rainy": 1},
        "hot_week": {"temp_avg": 34},
        "holiday_surge": {"is_pre_holiday": 1},
    }
    
    context = scenarios.get(scenario, None)
    result = forecast_daily_qty(horizon_days=horizon_days, context_overrides=context)
    result["scenario"] = scenario
    
    return result
