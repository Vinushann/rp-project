from __future__ import annotations

from typing import Any, Dict, Tuple, List
import pandas as pd
import numpy as np
import re



DEFAULT_DELIMS = [",", ";", "|", "/"]


def _is_stringy(series: pd.Series) -> bool:
    return pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series)


def _numeric_parse_success_ratio(s: pd.Series, sample_n: int = 200) -> float:
    sample = s.dropna().astype(str).head(sample_n)
    if sample.empty:
        return 0.0
    cleaned = (
        sample.str.replace(",", "", regex=False)
              .str.replace(r"[^0-9\.\-\+eE]", "", regex=True)
    )
    parsed = pd.to_numeric(cleaned, errors="coerce")
    return float(parsed.notna().mean())


def _delim_hit_ratio(s: pd.Series, delim: str, sample_n: int = 300) -> float:
    sample = s.dropna().astype(str).head(sample_n)
    if sample.empty:
        return 0.0
    return float(sample.str.contains(re.escape(delim)).mean())


def prepare_for_analysis_generic(
    df: pd.DataFrame,
    delims: List[str] = DEFAULT_DELIMS,
    multi_value_min_ratio: float = 0.08,
    mixed_numeric_low: float = 0.2,
    mixed_numeric_high: float = 0.8,
    zero_as_missing_min_ratio: float = 0.3,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Generic, dataset-agnostic DS preparation.
    - No hardcoded column names.
    - Adds derived columns instead of overwriting original values (safer).
    """
    df = df.copy()
    report: Dict[str, Any] = {"actions": []}

    # --- 1) Multi-valued categorical detection ---
    str_cols = [c for c in df.columns if _is_stringy(df[c])]
    for c in str_cols:
        # Find best delimiter (if any)
        best = None
        best_ratio = 0.0
        for d in delims:
            r = _delim_hit_ratio(df[c], d)
            if r > best_ratio:
                best_ratio = r
                best = d

        if best and best_ratio >= multi_value_min_ratio:
            flag_col = f"{c}__is_multi"
            primary_col = f"{c}__primary"

            s = df[c].astype("string")
            df[flag_col] = s.str.contains(re.escape(best), na=False)
            df[primary_col] = (
                s.str.split(best)
                 .str[0]
                 .str.strip()
            )

            report["actions"].append({
                "type": "multi_value_categorical_detected",
                "column": c,
                "delimiter": best,
                "hit_ratio": round(best_ratio, 4),
                "added_columns": [flag_col, primary_col]
            })

    # --- 2) Mixed-type columns (part numeric, part text) ---
    # Only for string columns
    for c in str_cols:
        # Skip if we already created primary for it and want to keep things simple
        # (Optional: remove this if you want both)
        # if f"{c}__primary" in df.columns:
        #     continue

        ratio = _numeric_parse_success_ratio(df[c])
        if mixed_numeric_low <= ratio <= mixed_numeric_high:
            num_col = f"{c}__num"
            txt_col = f"{c}__text"

            raw = df[c].astype("string")
            cleaned = (
                raw.str.replace(",", "", regex=False)
                   .str.replace(r"[^0-9\.\-\+eE]", "", regex=True)
            )
            parsed = pd.to_numeric(cleaned, errors="coerce")

            df[num_col] = parsed
            df[txt_col] = raw.where(parsed.isna())

            report["actions"].append({
                "type": "mixed_type_split",
                "column": c,
                "numeric_parse_ratio": round(ratio, 4),
                "added_columns": [num_col, txt_col]
            })

    # --- 3) Zero likely means missing (conservative) ---
    num_cols = df.select_dtypes(include=["number"]).columns.tolist()
    for c in num_cols:
        s = df[c]
        if s.isna().all():
            continue

        # Must have both zeros and non-zeros
        zero_ratio = float((s == 0).mean()) if len(s) else 0.0
        nonzero_exists = bool((s != 0).any())

        # Avoid constant-zero columns
        if not nonzero_exists:
            continue

        if zero_ratio >= zero_as_missing_min_ratio:
            derived = f"{c}__zero_as_na"
            df[derived] = s.mask(s == 0, pd.NA)

            report["actions"].append({
                "type": "zero_as_missing_candidate",
                "column": c,
                "zero_ratio": round(zero_ratio, 4),
                "added_column": derived,
                "note": "Derived column created; original preserved."
            })

    return df, report
