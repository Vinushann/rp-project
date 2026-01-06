from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Any, Tuple, List
import pandas as pd


@dataclass
class Profile:
    rows: int
    cols: int
    missing_by_col: Dict[str, int]
    numeric_cols: List[str]
    datetime_cols: List[str]


def _try_parse_dates(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    parsed = []
    for c in df.columns:
        if df[c].dtype == "object":
            # try parse as datetime if enough values look like dates
            try:
                s = pd.to_datetime(df[c], errors="coerce")
                # if at least 70% non-null after parsing, accept
                if s.notna().mean() >= 0.7:
                    df[c] = s
                    parsed.append(c)
            except Exception:
                pass
    return df, parsed


def clean_and_profile(df: pd.DataFrame) -> Tuple[pd.DataFrame, Profile]:
    # drop fully empty columns
    df = df.dropna(axis=1, how="all")

    # parse datetimes where possible
    df, datetime_cols = _try_parse_dates(df)

    # infer numeric where possible
    for c in df.columns:
        if df[c].dtype == "object":
            # try numeric conversion
            try:
                s = pd.to_numeric(df[c], errors="coerce")
                # accept if most values become numbers
                if s.notna().mean() >= 0.7:
                    df[c] = s
            except Exception:
                pass

    missing = df.isna().sum().to_dict()
    numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]

    profile = Profile(
        rows=int(df.shape[0]),
        cols=int(df.shape[1]),
        missing_by_col={k: int(v) for k, v in missing.items()},
        numeric_cols=numeric_cols,
        datetime_cols=datetime_cols,
    )
    return df, profile
