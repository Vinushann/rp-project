"""Helpers for item-level history insights."""
from __future__ import annotations
from typing import Dict, List, Optional
import pandas as pd


def _require_columns(df: pd.DataFrame, required: List[str]) -> None:
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise ValueError(f"Dataframe missing required columns: {missing}")


def _month_slice(
    df: pd.DataFrame,
    month: int,
    date_col: str,
    reference_year: Optional[int],
    years_back: int,
) -> pd.DataFrame:
    if not 1 <= month <= 12:
        raise ValueError("Month must be between 1 and 12")

    years = df[date_col].dt.year
    latest_year = reference_year or int(years.max())
    start_year = max(years.min(), latest_year - years_back + 1)

    mask = (df[date_col].dt.month == month) & (years.between(start_year, latest_year))
    return df.loc[mask].copy()


def get_item_history(
    df: pd.DataFrame,
    month: int,
    *,
    years_back: int = 4,
    reference_year: Optional[int] = None,
    date_col: str = "system_date",
    item_col: str = "food_name",
    qty_col: str = "qty",
    revenue_col: str = "total_price",
    discount_col: str = "discount_rate",
    top_n: int = 5,
) -> Dict[str, List[Dict[str, float]]]:
    """Return structured insights about item performance for a target month."""

    _require_columns(df, [date_col, item_col, qty_col, revenue_col, discount_col])
    sliced = _month_slice(df, month, date_col, reference_year, years_back)
    if sliced.empty:
        return {
            "month": month,
            "years_considered": [],
            "top_items": [],
            "falling_items": [],
            "discount_focus": [],
        }

    years = sorted(sliced[date_col].dt.year.unique())

    grouped = (
        sliced.groupby(item_col)
        .agg(
            total_qty=(qty_col, "sum"),
            avg_daily_qty=(qty_col, "mean"),
            avg_revenue=(revenue_col, "mean"),
            avg_discount=(discount_col, "mean"),
        )
        .sort_values("total_qty", ascending=False)
    )

    def _format_row(row) -> Dict[str, float]:
        return {
            "item": row.name,
            "avg_daily_qty": round(row.avg_daily_qty, 2),
            "monthly_qty": int(row.total_qty),
            "avg_ticket": round(row.avg_revenue, 2),
            "avg_discount": round(row.avg_discount, 3),
        }

    top_items = [_format_row(row) for _, row in grouped.head(top_n).iterrows()]

    yearly = (
        sliced.assign(year=sliced[date_col].dt.year)
        .groupby([item_col, "year"])[qty_col]
        .sum()
        .unstack(fill_value=0)
        .sort_index(axis=1)
    )

    falling_items: List[Dict[str, float]] = []
    if yearly.shape[1] >= 2:
        latest_year = yearly.columns[-1]
        prev_year = yearly.columns[-2]
        prev_values = yearly.get(prev_year)
        latest_values = yearly.get(latest_year)
        change = latest_values - prev_values
        percent_change = change / prev_values.replace({0: pd.NA})
        data = (
            pd.DataFrame(
                {
                    "item": yearly.index,
                    "latest_qty": latest_values,
                    "previous_qty": prev_values,
                    "change": change,
                    "percent_change": percent_change,
                }
            )
            .replace({pd.NA: 0})
            .sort_values("percent_change")
        )
        falling_items = [
            {
                "item": row.item,
                "latest_qty": int(row.latest_qty),
                "previous_qty": int(row.previous_qty),
                "percent_change": round(float(row.percent_change), 3) if row.previous_qty else -1.0,
            }
            for row in data.head(top_n).itertuples()
            if row.previous_qty > 0 and row.percent_change < 0
        ]

    discount_focus = (
        grouped.sort_values("avg_discount", ascending=False)
        .head(top_n)
        .apply(_format_row, axis=1)
        .tolist()
    )

    return {
        "month": month,
        "years_considered": years,
        "top_items": top_items,
        "falling_items": falling_items,
        "discount_focus": discount_focus,
    }
