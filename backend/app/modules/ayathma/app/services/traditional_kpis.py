from __future__ import annotations
from typing import Dict, Any, List
import pandas as pd


def compute_generic_kpis(df: pd.DataFrame, semantic: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generic KPI set that works for almost any tabular dataset.

    Produces:
    - dataset health KPIs
    - numeric summaries (sum/mean/median/std/min/max)
    - categorical summaries (top values, distinct counts)
    - time summaries (if datetime exists)
    """
    out: Dict[str, Any] = {}

    rows = int(df.shape[0])
    cols = int(df.shape[1])

    out["rows"] = rows
    out["columns"] = cols
    out["missing_cells"] = int(df.isna().sum().sum())
    out["missing_rate"] = float(out["missing_cells"] / (rows * cols)) if rows and cols else 0.0

    numeric_cols: List[str] = semantic.get("numeric_cols", [])
    datetime_cols: List[str] = semantic.get("datetime_cols", [])
    categorical_cols: List[str] = semantic.get("categorical_cols", [])
    id_like_cols: List[str] = semantic.get("id_like_cols", [])

    # Row count KPIs
    out["row_count"] = rows
    if id_like_cols:
        idc = id_like_cols[0]
        out["primary_id_distinct"] = int(df[idc].nunique(dropna=True))

    # Numeric KPIs
    numeric_kpis: Dict[str, Any] = {}
    for c in numeric_cols:
        s = df[c].dropna()
        if len(s) == 0:
            continue
        numeric_kpis[c] = {
            "sum": float(s.sum()),
            "mean": float(s.mean()),
            "median": float(s.median()),
            "std": float(s.std()) if len(s) > 1 else 0.0,
            "min": float(s.min()),
            "max": float(s.max()),
            "missing": int(df[c].isna().sum()),
        }
    out["numeric_summary"] = numeric_kpis

    # Categorical KPIs
    cat_kpis: Dict[str, Any] = {}
    for c in categorical_cols:
        s = df[c].dropna().astype(str)
        if len(s) == 0:
            continue
        vc = s.value_counts().head(10)
        cat_kpis[c] = {
            "distinct": int(s.nunique()),
            "top_values": [{"value": k, "count": int(v)} for k, v in vc.items()],
            "missing": int(df[c].isna().sum()),
        }
    out["categorical_summary"] = cat_kpis

    # Time KPIs (trend-friendly)
    time_kpis: Dict[str, Any] = {}
    if datetime_cols:
        # pick the first datetime column as "main time" for v1
        tcol = datetime_cols[0]
        ts = pd.to_datetime(df[tcol], errors="coerce")
        time_kpis["time_column"] = tcol
        time_kpis["min_time"] = str(ts.min()) if ts.notna().any() else None
        time_kpis["max_time"] = str(ts.max()) if ts.notna().any() else None

        # If we have numeric cols too, create simple daily aggregates
        if numeric_cols and ts.notna().any():
            tmp = df.copy()
            tmp["_date"] = ts.dt.date
            daily = tmp.groupby("_date")[numeric_cols].sum(numeric_only=True).head(30)
            time_kpis["daily_numeric_sum_sample"] = daily.reset_index().to_dict(orient="records")

    out["time_summary"] = time_kpis

    return out
