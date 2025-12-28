"""Context helpers for holidays and weather."""
from __future__ import annotations

from typing import Dict, List, Tuple

import pandas as pd

HOLIDAY_COLUMNS = ["is_holiday", "holiday_name", "is_pre_holiday", "is_post_holiday"]
WEATHER_COLUMNS = ["temp_avg", "rain_mm", "is_rainy"]


def _require(df: pd.DataFrame, cols: List[str]) -> None:
    missing = [col for col in cols if col not in df.columns]
    if missing:
        raise ValueError(f"Missing columns: {missing}")


def get_holiday_context(df: pd.DataFrame, month: int) -> List[Dict[str, str]]:
    _require(df, HOLIDAY_COLUMNS + ["system_date", "qty"])
    mask = df["system_date"].dt.month == month
    month_df = df.loc[mask].copy()
    if month_df.empty:
        return []

    holiday_mask = (
        month_df["is_holiday"].eq(1)
        | month_df["is_pre_holiday"].eq(1)
        | month_df["is_post_holiday"].eq(1)
    )
    holidays = month_df.loc[holiday_mask]
    if holidays.empty:
        return []

    baseline = month_df.loc[~holiday_mask, "qty"].mean()
    output = []
    for name, group in holidays.groupby("holiday_name"):
        avg_qty = group["qty"].mean()
        effect = ((avg_qty - baseline) / max(baseline, 1e-5)) * 100 if baseline else 0
        phase = "holiday"
        if int(group["is_pre_holiday"].max()) == 1:
            phase = "pre-holiday"
        elif int(group["is_post_holiday"].max()) == 1:
            phase = "post-holiday"
        tip = _holiday_tip(effect)
        output.append(
            {
                "holiday": name or "Unnamed",
                "phase": phase,
                "avg_qty": round(float(avg_qty), 2),
                "effect_pct": round(float(effect), 2),
                "action": tip,
            }
        )
    return output


def _holiday_tip(effect: float) -> str:
    if effect > 10:
        return "Plan extra staff and promote key bundles"
    if effect > 0:
        return "Stock up and highlight best sellers"
    if effect < -5:
        return "Consider light promos to lift demand"
    return "Monitor closely; keep standard operations"


CATEGORY_TAGS: List[Tuple[str, List[str]]] = [
    ("hot_drinks", ["latte", "espresso", "americano", "tea"]),
    ("cold_drinks", ["iced", "frappe", "smoothie", "cold"]),
    ("food_pastries", ["cake", "sandwich", "bun", "pastry"]),
]


def _tag_item(name: str) -> str:
    lowered = name.lower()
    for tag, keywords in CATEGORY_TAGS:
        if any(keyword in lowered for keyword in keywords):
            return tag
    return "other"


def get_weather_context(df: pd.DataFrame, month: int) -> Dict[str, List[Dict[str, str]]]:
    _require(df, WEATHER_COLUMNS + ["system_date", "qty", "food_name"])
    month_df = df.loc[df["system_date"].dt.month == month].copy()
    if month_df.empty:
        return {"rain_effect": [], "temperature_effect": []}

    month_df["category"] = month_df["food_name"].apply(_tag_item)
    rain = _rain_effect(month_df)
    temperature = _temperature_effect(month_df)
    return {"rain_effect": rain, "temperature_effect": temperature}


def _rain_effect(df: pd.DataFrame) -> List[Dict[str, str]]:
    if "is_rainy" not in df.columns:
        return []
    output = []
    for category, group in df.groupby("category"):
        rainy = group.loc[group["is_rainy"].eq(1), "qty"].mean()
        dry = group.loc[group["is_rainy"].eq(0), "qty"].mean()
        if pd.isna(rainy) or pd.isna(dry):
            continue
        change = ((rainy - dry) / max(dry, 1e-5)) * 100 if dry else 0
        tip = "Push rainy-day combos" if change > 5 else "No big rain impact"
        output.append(
            {
                "category": category,
                "change_pct": round(float(change), 2),
                "action": tip,
            }
        )
    return output


def _temperature_effect(df: pd.DataFrame) -> List[Dict[str, str]]:
    if "temp_avg" not in df.columns:
        return []
    bins = [0, 26, 29, 40]
    labels = ["cool", "warm", "hot"]
    df = df.copy()
    df["temp_bucket"] = pd.cut(df["temp_avg"], bins=bins, labels=labels, include_lowest=True)

    output = []
    for category, group in df.groupby(["category", "temp_bucket"]):
        avg_qty = group["qty"].mean()
        bucket = category[1]
        if pd.isna(avg_qty) or bucket is pd.NA:
            continue
        tip = _temp_tip(bucket, category[0])
        output.append(
            {
                "category": category[0],
                "temperature": str(bucket),
                "avg_qty": round(float(avg_qty), 2),
                "action": tip,
            }
        )
    return output


def _temp_tip(bucket: str, category: str) -> str:
    if bucket == "hot" and category == "cold_drinks":
        return "Highlight iced drinks and smoothies"
    if bucket == "cool" and category == "hot_drinks":
        return "Promote warm drinks"
    return "Keep standard offer"
