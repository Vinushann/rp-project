from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Optional
import pandas as pd
import re


@dataclass
class SemanticProfile:
    rows: int
    cols: int
    numeric_cols: List[str]
    datetime_cols: List[str]
    categorical_cols: List[str]
    id_like_cols: List[str]
    text_like_cols: List[str]


_ID_HINTS = {"id", "uuid", "guid", "code", "key", "no", "number", "ref"}
_TEXT_THRESHOLD_AVG_LEN = 25


def _looks_like_id(col: str, s: pd.Series) -> bool:
    name = col.lower()
    if any(h in name for h in _ID_HINTS):
        return True

    # High uniqueness + short tokens often behave like IDs
    non_null = s.dropna().astype(str)
    if len(non_null) == 0:
        return False
    uniq_ratio = non_null.nunique() / len(non_null)
    avg_len = non_null.str.len().mean()
    return (uniq_ratio > 0.95) and (avg_len <= 20)


def _looks_like_text(s: pd.Series) -> bool:
    non_null = s.dropna().astype(str)
    if len(non_null) == 0:
        return False
    avg_len = non_null.str.len().mean()
    return avg_len >= _TEXT_THRESHOLD_AVG_LEN


def build_semantic_profile(df: pd.DataFrame, datetime_cols: Optional[List[str]] = None) -> SemanticProfile:
    datetime_cols = datetime_cols or []
    numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    object_cols = [c for c in df.columns if df[c].dtype == "object"]

    id_like = []
    text_like = []
    categorical = []

    for c in object_cols:
        s = df[c]
        if _looks_like_id(c, s):
            id_like.append(c)
        elif _looks_like_text(s):
            text_like.append(c)
        else:
            categorical.append(c)

    return SemanticProfile(
        rows=int(df.shape[0]),
        cols=int(df.shape[1]),
        numeric_cols=numeric_cols,
        datetime_cols=datetime_cols,
        categorical_cols=categorical,
        id_like_cols=id_like,
        text_like_cols=text_like,
    )
