"""CrewAI tool definitions that wrap the analytics helpers."""
from __future__ import annotations

import json
import os
from dataclasses import asdict
from typing import Optional, Type

import pandas as pd
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
import numpy as np

from .data_loader import add_calendar_columns, load_sales_data
from .forecast_tools import ForecastResult, forecast_daily
from .item_tools import get_item_history
from .context_tools import get_holiday_context, get_weather_context


def _default_dataset_path() -> str:
    return os.getenv(
        "SALES_DATA_PATH",
        "data/the_rossmann_coffee_shop_sales_dataset.csv",
    )


def _json_default(obj):
    if isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    if isinstance(obj, (np.floating, np.float32, np.float64)):
        return float(obj)
    if obj is pd.NA:
        return None
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


class SalesToolBase(BaseTool):
    dataset_path: str = Field(
        default_factory=_default_dataset_path,
        description="Path to the cleaned Rossmann coffee shop dataset.",
    )

    def _load_dataframe(self) -> pd.DataFrame:
        df = load_sales_data(self.dataset_path, copy=True)
        return add_calendar_columns(df)


class ItemHistoryInput(BaseModel):
    month: int = Field(..., ge=1, le=12, description="Target month number (1-12).")
    years_back: int = Field(4, ge=1, le=10, description="How many years of history to use.")
    reference_year: Optional[int] = Field(
        None, description="Reference year; defaults to the most recent year in the data."
    )


class ItemHistoryTool(SalesToolBase):
    name: str = "Item History Tool"
    description: str = (
        "Summarize top, falling, and discount-sensitive items for a specific month."
    )
    args_schema: Type[BaseModel] = ItemHistoryInput

    def _run(self, month: int, years_back: int = 4, reference_year: Optional[int] = None) -> str:
        df = self._load_dataframe()
        summary = get_item_history(
            df,
            month,
            years_back=years_back,
            reference_year=reference_year,
        )
        return json.dumps(summary, indent=2, default=_json_default)


class ForecastInput(BaseModel):
    month: Optional[int] = Field(
        None,
        description="Target forecast month (1-12). Defaults to most recent month if omitted.",
    )
    year: Optional[int] = Field(
        None,
        description="Target forecast year. Defaults to the last year in the dataset if omitted.",
    )
    blend_weight: float = Field(
        0.6,
        ge=0.0,
        le=1.0,
        description="Weight applied to the seasonal naive component when blending with the moving average.",
    )


class ForecastingTool(SalesToolBase):
    name: str = "Daily Forecast Tool"
    description: str = "Forecast next month's daily demand with a blended seasonal baseline."
    args_schema: Type[BaseModel] = ForecastInput

    def _run(self, month: Optional[int] = None, year: Optional[int] = None, blend_weight: float = 0.6) -> str:
        df = self._load_dataframe()
        result: ForecastResult = forecast_daily(df, month=month, year=year, blend_weight=blend_weight)
        payload = asdict(result)
        return json.dumps(payload, indent=2, default=_json_default)


class MonthOnlyInput(BaseModel):
    month: int = Field(..., ge=1, le=12, description="Target month number (1-12).")


class HolidayContextTool(SalesToolBase):
    name: str = "Holiday Context Tool"
    description: str = "Explain how holidays, pre-holidays, and post-holidays change demand."
    args_schema: Type[BaseModel] = MonthOnlyInput

    def _run(self, month: int) -> str:
        df = self._load_dataframe()
        context = get_holiday_context(df, month)
        return json.dumps(context, indent=2, default=_json_default)


class WeatherContextTool(SalesToolBase):
    name: str = "Weather Context Tool"
    description: str = "Describe how rain and temperature affect each menu category."
    args_schema: Type[BaseModel] = MonthOnlyInput

    def _run(self, month: int) -> str:
        df = self._load_dataframe()
        context = get_weather_context(df, month)
        return json.dumps(context, indent=2, default=_json_default)
