"""Utility helpers to load and enrich the Rossmann coffee shop dataset."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Union

import pandas as pd

PathLike = Union[str, Path]


def _resolve(path: PathLike) -> Path:
    path_obj = Path(path).expanduser()
    if not path_obj.is_absolute():
        path_obj = (Path.cwd() / path_obj).resolve()
    return path_obj


@lru_cache(maxsize=4)
def _read_csv(path_str: str, date_col: str) -> pd.DataFrame:
    path = _resolve(path_str)
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found at {path}")

    df = pd.read_csv(path)
    if date_col not in df.columns:
        raise ValueError(f"Date column '{date_col}' missing from dataset")

    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    if df[date_col].isna().any():
        raise ValueError("Dataset contains rows with invalid dates; please fix the source file")

    return df


def load_sales_data(path: PathLike, date_col: str = "system_date", copy: bool = True) -> pd.DataFrame:
    """Load the cleaned Rossmann dataset once and optionally return a copy."""
    df = _read_csv(str(_resolve(path)), date_col)
    return df.copy() if copy else df


def add_calendar_columns(df: pd.DataFrame, date_col: str = "system_date") -> pd.DataFrame:
    """Ensure the dataframe exposes handy calendar helper columns."""
    if date_col not in df.columns:
        raise ValueError(f"Column '{date_col}' not found in dataframe")

    enriched = df.copy()
    enriched["year"] = enriched[date_col].dt.year
    enriched["month"] = enriched[date_col].dt.month
    enriched["day"] = enriched[date_col].dt.day
    enriched["day_of_week"] = enriched[date_col].dt.dayofweek
    enriched["is_weekend"] = enriched["day_of_week"].isin({5, 6}).astype(int)
    return enriched
