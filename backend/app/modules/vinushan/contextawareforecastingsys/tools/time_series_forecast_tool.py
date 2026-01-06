"""
Time Series Forecast Tool - CrewAI tool wrapper for Prophet model.
Enables the Forecasting Specialist agent to call the trained time series model.
"""

from __future__ import annotations

import json
from typing import Optional, Type, Dict, Any, List

from crewai.tools import BaseTool
from pydantic import BaseModel, Field
import numpy as np

from ..services.ts_forecast_service import forecast_daily_qty


def _json_default(obj):
    """Handle JSON serialization of numpy types."""
    if isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    if isinstance(obj, (np.floating, np.float32, np.float64)):
        return float(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


class TimeSeriesForecastInput(BaseModel):
    """Input schema for time series forecasting tool."""
    
    horizon_days: Optional[int] = Field(
        None,
        ge=1,
        le=365,
        description="Number of days to forecast from today. Use this OR start_date/end_date."
    )
    start_date: Optional[str] = Field(
        None,
        description="Start date for forecast in YYYY-MM-DD format. Use with end_date."
    )
    end_date: Optional[str] = Field(
        None,
        description="End date for forecast in YYYY-MM-DD format. Use with start_date."
    )
    context_overrides: Optional[Dict[str, Any]] = Field(
        None,
        description=(
            "Optional context overrides for what-if scenarios. "
            "Keys: rain_mm (float), is_rainy (0/1), temp_avg (float), "
            "is_holiday (0/1), is_pre_holiday (0/1), is_post_holiday (0/1)"
        )
    )


class TimeSeriesForecastTool(BaseTool):
    """
    CrewAI tool that invokes the trained Prophet time series model.
    
    This tool provides demand forecasting capabilities for the coffee shop,
    using a Prophet model trained on historical sales data with features:
    - Weekly and yearly seasonality
    - Sri Lankan holidays (Poya days, festivals)
    - Weather effects (temperature, rain)
    - Calendar features (weekend, pre/post holiday)
    
    The model was trained on 2020-2025 data and achieved:
    - MAE: 7.94
    - RMSE: 15.58
    - 64% improvement over baseline
    """
    
    name: str = "Time Series Forecast Tool"
    description: str = (
        "Use the trained Prophet time series model to forecast daily sales quantity. "
        "Provides demand predictions with confidence intervals, identifies busiest days, "
        "and supports what-if scenarios (e.g., rainy week, hot weather). "
        "Use horizon_days for a rolling forecast, or start_date/end_date for specific periods. "
        "Returns predictions with yhat (forecast), yhat_lower/upper (confidence bounds), "
        "plus summary with total quantity, busiest days, and uncertainty notes."
    )
    args_schema: Type[BaseModel] = TimeSeriesForecastInput
    
    def _run(
        self,
        horizon_days: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        context_overrides: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Execute the forecast and return results as JSON string.
        
        Args:
            horizon_days: Days to forecast from today
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            context_overrides: Weather/context overrides for scenarios
            
        Returns:
            JSON string with forecast results
        """
        # Call the forecast service
        result = forecast_daily_qty(
            horizon_days=horizon_days,
            start_date=start_date,
            end_date=end_date,
            context_overrides=context_overrides,
        )
        
        # Format for agent consumption - include key summary
        output = {
            "model": result.get("model", "prophet"),
            "target": result.get("target", "daily_total_qty"),
            "forecast_period": result.get("forecast_period", {}),
            "model_metrics": result.get("model_metrics", {}),
            "context_applied": result.get("context_applied", {}),
            "summary": result.get("summary", {}),
            # Limit predictions to first/last 5 for readability
            "sample_predictions": {
                "first_5_days": result.get("predictions", [])[:5],
                "last_5_days": result.get("predictions", [])[-5:] if len(result.get("predictions", [])) > 5 else [],
            },
            "total_days_predicted": len(result.get("predictions", [])),
        }
        
        # Add full predictions if small dataset
        if len(result.get("predictions", [])) <= 14:
            output["all_predictions"] = result.get("predictions", [])
        
        return json.dumps(output, indent=2, default=_json_default)
    
    async def _arun(
        self,
        horizon_days: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        context_overrides: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Async version - delegates to sync implementation."""
        return self._run(
            horizon_days=horizon_days,
            start_date=start_date,
            end_date=end_date,
            context_overrides=context_overrides,
        )
