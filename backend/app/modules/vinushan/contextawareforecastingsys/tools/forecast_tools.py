"""Baseline daily forecasting utilities."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class ForecastResult:
    month: int
    year: int
    predictions: List[Dict[str, float]]
    metrics: Dict[str, float]


REQUIRED_COLUMNS = [
    "system_date",
    "qty",
]


def _require_columns(df: pd.DataFrame) -> None:
    missing = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing:
        raise ValueError(f"Dataframe missing required columns: {missing}")


def prepare_daily_series(df: pd.DataFrame) -> pd.DataFrame:
    _require_columns(df)
    daily = (
        df.groupby("system_date", as_index=False)
        .agg(total_qty=("qty", "sum"), total_price=("total_price", "sum"))
        .sort_values("system_date")
    )
    daily["day_of_week"] = daily["system_date"].dt.dayofweek
    daily["month"] = daily["system_date"].dt.month
    daily["year"] = daily["system_date"].dt.year
    return daily


def _seasonal_naive(daily: pd.DataFrame, target_dates: pd.Series) -> pd.Series:
    """Return seasonal naive forecast: value from same date last year."""
    history = daily.set_index("system_date")["total_qty"]
    fallback = float(history.iloc[-1]) if len(history) > 0 else 0.0

    def lookup(date):
        past_date = date - pd.DateOffset(years=1)
        if past_date in history.index:
            return float(history.loc[past_date])
        return fallback

    # Ensure target_dates is a Series with proper index
    if isinstance(target_dates, pd.DatetimeIndex):
        target_series = pd.Series(target_dates, index=target_dates)
    else:
        target_series = pd.Series(target_dates)
        target_series.index = target_series.values

    result = target_series.map(lookup)
    return result


def _moving_average(daily: pd.DataFrame, window: int = 7) -> pd.Series:
    return (
        daily.set_index("system_date")["total_qty"].rolling(window=window, min_periods=1).mean()
    )


def forecast_daily(
    df: pd.DataFrame,
    month: Optional[int] = None,
    year: Optional[int] = None,
    *,
    blend_weight: float = 0.6,
) -> ForecastResult:
    _require_columns(df)
    daily = prepare_daily_series(df)
    latest_date = daily["system_date"].max()
    target_year = year or latest_date.year
    target_month = month or latest_date.month

    start_date = datetime(target_year, target_month, 1)
    next_month = start_date + pd.DateOffset(months=1)
    target_dates = pd.date_range(start_date, next_month - pd.Timedelta(days=1), freq="D")

    # Convert to Series for consistent handling
    target_series = pd.Series(target_dates, index=target_dates)

    seasonal = _seasonal_naive(daily, target_series)
    moving_avg = _moving_average(daily)

    # Reindex moving average to target dates, forward-fill missing
    ma_aligned = moving_avg.reindex(target_dates).ffill()
    if ma_aligned.isna().all():
        ma_aligned = ma_aligned.fillna(float(moving_avg.iloc[-1]) if len(moving_avg) > 0 else 0.0)

    blend = (blend_weight * seasonal + (1 - blend_weight) * ma_aligned).fillna(seasonal)

    predictions = [
        {"date": pd.Timestamp(date).strftime("%Y-%m-%d"), "predicted_qty": round(float(value), 2)}
        for date, value in blend.items()
    ]

    metrics = _evaluate_backtest(daily, target_month, target_year)
    return ForecastResult(month=target_month, year=target_year, predictions=predictions, metrics=metrics)


def _evaluate_backtest(daily: pd.DataFrame, target_month: int, target_year: int) -> Dict[str, float]:
    mask = (daily["month"] == target_month) & (daily["year"] == target_year - 1)
    if not mask.any():
        return {"mae": float("nan"), "mape": float("nan")}

    subset = daily.loc[mask].copy()
    # Shift dates forward by 1 year for forecast comparison
    shifted_dates = subset["system_date"] + pd.DateOffset(years=1)
    forecast = _seasonal_naive(daily, shifted_dates)

    actual = subset["total_qty"].values.astype(float)
    forecast_values = forecast.values.astype(float)

    mae = float(np.mean(np.abs(forecast_values - actual)))
    mape = float(np.mean(np.abs((forecast_values - actual) / np.maximum(actual, 1e-5)))) * 100
    return {"mae": round(mae, 2), "mape": round(mape, 2)}
