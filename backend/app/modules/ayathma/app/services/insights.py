from __future__ import annotations

from typing import Optional, Dict, Any, List, Tuple
import math

import pandas as pd


# ----------------------------
# helpers
# ----------------------------

def _pick_role_col(roles: Dict[str, Any], role_name: str) -> Optional[str]:
    info = (roles or {}).get(role_name) or {}
    col = info.get("col")
    return col if isinstance(col, str) and col else None


def _to_numeric(s: pd.Series) -> pd.Series:
    return pd.to_numeric(s, errors="coerce")


def _safe_sum(s: pd.Series) -> float:
    x = _to_numeric(s).fillna(0)
    return float(x.sum())


def _safe_nunique(s: pd.Series) -> int:
    return int(s.dropna().nunique())


def _format_number(x: Optional[float], kind: str = "number") -> str:
    if x is None:
        return "N/A"
    if isinstance(x, float) and (math.isnan(x) or math.isinf(x)):
        return "N/A"

    if kind == "money":
        return f"{x:,.2f}"
    if kind == "percent":
        return f"{x*100:.2f}%"
    if kind == "int":
        return f"{int(x):,}"
    return f"{x:,.2f}"


def _topn_table(df: pd.DataFrame, group_col: str, measure_col: str, n: int = 10) -> List[Dict[str, Any]]:
    g = df[[group_col, measure_col]].copy()
    g[measure_col] = pd.to_numeric(g[measure_col], errors="coerce")
    g = g.dropna(subset=[group_col])
    out = (
        g.groupby(group_col, dropna=False)[measure_col]
        .sum(min_count=1)
        .sort_values(ascending=False)
        .head(n)
        .reset_index()
    )
    out[measure_col] = out[measure_col].fillna(0.0)
    return out.to_dict(orient="records")


def _distribution_table(df: pd.DataFrame, measure_col: str) -> List[Dict[str, Any]]:
    s = pd.to_numeric(df[measure_col], errors="coerce").dropna()
    if len(s) == 0:
        return []
    q = s.quantile([0.0, 0.25, 0.5, 0.75, 1.0]).to_dict()
    return [
        {"metric": "min", "value": float(q.get(0.0, 0.0))},
        {"metric": "p25", "value": float(q.get(0.25, 0.0))},
        {"metric": "median", "value": float(q.get(0.5, 0.0))},
        {"metric": "p75", "value": float(q.get(0.75, 0.0))},
        {"metric": "max", "value": float(q.get(1.0, 0.0))},
        {"metric": "mean", "value": float(s.mean())},
    ]


def _time_agg(df: pd.DataFrame, time_col: str, measure_col: str, freq: str) -> List[Dict[str, Any]]:
    d = df[[time_col, measure_col]].copy()
    d[time_col] = pd.to_datetime(d[time_col], errors="coerce")
    d[measure_col] = pd.to_numeric(d[measure_col], errors="coerce")
    d = d.dropna(subset=[time_col])
    if len(d) == 0:
        return []

    if freq == "D":
        key = d[time_col].dt.date.astype(str)
    else:
        key = d[time_col].dt.to_period("M").astype(str)

    out = (
        d.assign(_t=key)
        .groupby("_t", dropna=False)[measure_col]
        .sum(min_count=1)
        .reset_index()
        .sort_values("_t")
    )
    out[measure_col] = out[measure_col].fillna(0.0)
    return out.rename(columns={"_t": "time"}).to_dict(orient="records")


def _make_card(
    title: str,
    why: str,
    table: List[Dict[str, Any]],
    chart: Dict[str, Any],
    card_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a normalized card dict used by the frontend.

    card_id is an optional stable identifier (e.g. "measure_over_time_daily")
    that can be used for ML training labels.
    """
    card = {"title": title, "why": why, "table": table, "chart": chart}
    if card_id:
        card["id"] = card_id

    if table and chart.get("x") and chart.get("y"):
        xk = chart["x"]
        yk = chart["y"]
        labels = []
        values = []
        for row in table:
            if xk in row and yk in row:
                labels.append(str(row[xk]))
                try:
                    values.append(float(row[yk]))
                except Exception:
                    values.append(0.0)
        if labels and values:
            card["chart_data"] = {"labels": labels, "values": values}
    return card


# ----------------------------
# KPI summary strip
# ----------------------------

def build_kpi_summary(df: pd.DataFrame, roles: Dict[str, Any], selected: Dict[str, Any]) -> Dict[str, Any]:
    revenue_col = _pick_role_col(roles, "REVENUE") or selected.get("measure")
    cost_col = _pick_role_col(roles, "COST_AMOUNT")
    discount_col = _pick_role_col(roles, "DISCOUNT_AMOUNT")
    qty_col = _pick_role_col(roles, "QUANTITY")

    order_id_col = _pick_role_col(roles, "ORDER_ID")
    txn_id_col = _pick_role_col(roles, "TRANSACTION_ID")

    time_col = _pick_role_col(roles, "DATE") or _pick_role_col(roles, "DATETIME") or selected.get("time")

    revenue_total: Optional[float] = None
    if revenue_col in df.columns:
        revenue_total = _safe_sum(df[revenue_col])

    orders_count: Optional[int] = None
    if order_id_col in df.columns:
        orders_count = _safe_nunique(df[order_id_col])
    elif txn_id_col in df.columns:
        orders_count = _safe_nunique(df[txn_id_col])
    else:
        orders_count = int(len(df)) if len(df) else None

    aov: Optional[float] = None
    if revenue_total is not None and orders_count and orders_count > 0:
        aov = revenue_total / orders_count

    items_sold: Optional[float] = None
    if qty_col in df.columns:
        items_sold = _safe_sum(df[qty_col])

    cost_total: Optional[float] = None
    if cost_col in df.columns:
        cost_total = _safe_sum(df[cost_col])

    discount_total: Optional[float] = None
    if discount_col in df.columns:
        discount_total = _safe_sum(df[discount_col])

    gross_margin: Optional[float] = None
    if revenue_total and revenue_total > 0 and cost_total is not None:
        gross_margin = (revenue_total - cost_total) / revenue_total

    discount_rate: Optional[float] = None
    if revenue_total and revenue_total > 0 and discount_total is not None:
        discount_rate = discount_total / revenue_total

    date_range = None
    if time_col in df.columns:
        t = pd.to_datetime(df[time_col], errors="coerce").dropna()
        if len(t):
            date_range = {"start": str(t.min().date()), "end": str(t.max().date())}

    tiles: List[Dict[str, Any]] = []
    tiles.append({"label": "Total Revenue", "value": _format_number(revenue_total, "money"), "hint": revenue_col if revenue_col in df.columns else "N/A"})
    tiles.append({"label": "Orders", "value": _format_number(float(orders_count) if orders_count is not None else None, "int"), "hint": order_id_col or txn_id_col or "rows"})
    tiles.append({"label": "Avg Order Value (AOV)", "value": _format_number(aov, "money"), "hint": "revenue / orders"})

    if items_sold is not None:
        tiles.append({"label": "Items Sold", "value": _format_number(items_sold, "int"), "hint": qty_col})

    if gross_margin is not None:
        tiles.append({"label": "Gross Margin", "value": _format_number(gross_margin, "percent"), "hint": "1 - (cost/revenue)"})

    if discount_rate is not None:
        tiles.append({"label": "Discount Rate", "value": _format_number(discount_rate, "percent"), "hint": discount_col})

    return {
        "tiles": tiles,
        "date_range": date_range,
        "used": {
            "revenue_col": revenue_col if revenue_col in df.columns else None,
            "cost_col": cost_col if cost_col in df.columns else None,
            "discount_col": discount_col if discount_col in df.columns else None,
            "qty_col": qty_col if qty_col in df.columns else None,
            "order_id_col": order_id_col if order_id_col in df.columns else None,
            "txn_id_col": txn_id_col if txn_id_col in df.columns else None,
            "time_col": time_col if time_col in df.columns else None,
        }
    }


# ----------------------------
# selection logic
# ----------------------------

def _choose_measure(df: pd.DataFrame, semantic: Dict[str, Any], roles: Dict[str, Any], override: Optional[str]) -> Optional[str]:
    if override and override in df.columns:
        return override

    role_rev = _pick_role_col(roles, "REVENUE")
    if role_rev and role_rev in df.columns:
        return role_rev

    numeric_cols = list(semantic.get("numeric_cols", []))
    best = None
    best_score = -1.0
    for c in numeric_cols:
        if c not in df.columns:
            continue
        s = pd.to_numeric(df[c], errors="coerce")
        miss = float(s.isna().mean())
        if miss > 0.8:
            continue
        score = float(s.dropna().std()) if len(s.dropna()) else 0.0
        score = score * (1.0 - miss)
        if score > best_score:
            best_score = score
            best = c
    return best


def _choose_time(df: pd.DataFrame, semantic: Dict[str, Any], roles: Dict[str, Any], override: Optional[str]) -> Optional[str]:
    if override and override in df.columns:
        return override

    role_date = _pick_role_col(roles, "DATE") or _pick_role_col(roles, "DATETIME")
    if role_date and role_date in df.columns:
        return role_date

    dt_cols = list(semantic.get("datetime_cols", []))
    for c in dt_cols:
        if c in df.columns:
            return c
    return None


def _choose_dimensions(
    df: pd.DataFrame,
    semantic: Dict[str, Any],
    roles: Dict[str, Any],
    overrides: Optional[List[str]],
    measure_col: Optional[str],
    max_dims: int = 3,
) -> List[str]:
    if overrides:
        return [c for c in overrides if c in df.columns][:max_dims]

    prefs = []
    for r in ["PRODUCT_NAME", "CATEGORY", "CHANNEL", "PAYMENT_METHOD", "LOCATION"]:
        c = _pick_role_col(roles, r)
        if c and c in df.columns:
            prefs.append(c)

    out: List[str] = []
    for c in prefs:
        if c not in out:
            out.append(c)
        if len(out) >= max_dims:
            return out

    cat_cols = list(semantic.get("categorical_cols", []))
    scored: List[Tuple[float, str]] = []
    for c in cat_cols:
        if c not in df.columns:
            continue
        nun = df[c].dropna().nunique()
        if nun < 2:
            continue
        if nun > 2000:
            continue
        score = 1.0 / (1.0 + abs(nun - 25))
        scored.append((score, c))

    scored.sort(reverse=True, key=lambda x: x[0])
    for _, c in scored:
        if c not in out:
            out.append(c)
        if len(out) >= max_dims:
            break

    if not out:
        for c in df.columns:
            if c == measure_col:
                continue
            out.append(c)
            break

    return out


# ----------------------------
# Step 5: FA experimental signals
# ----------------------------

def _extract_fa_loadings(fa: Dict[str, Any]) -> Optional[pd.DataFrame]:
    """
    Supported shapes:
    - fa["loadings"] as { "columns": [...], "factors": [...], "values": [[...], ...] }
    - fa["loadings"] as list of dicts: [{"variable": col, "Factor1": x, ...}, ...]
    - fa["loadings"] as dict-of-dicts: {col: {Factor1: x, ...}, ...}
    """
    loadings = fa.get("loadings")
    if loadings is None:
        return None

    # shape C: dict-of-dicts
    if isinstance(loadings, dict) and loadings and all(isinstance(v, dict) for v in loadings.values()):
        dfL = pd.DataFrame(loadings).T
        dfL.index = dfL.index.astype(str)
        dfL.columns = [str(c) for c in dfL.columns]
        return dfL

    # shape A
    if isinstance(loadings, dict) and "columns" in loadings and "values" in loadings:
        cols = loadings.get("columns") or []
        values = loadings.get("values") or []
        factors = loadings.get("factors")

        dfL = pd.DataFrame(values, index=cols)
        if factors and len(factors) == dfL.shape[1]:
            dfL.columns = factors
        else:
            dfL.columns = [f"Factor{i+1}" for i in range(dfL.shape[1])]
        return dfL

    # shape B
    if isinstance(loadings, list) and len(loadings) > 0 and isinstance(loadings[0], dict):
        dfL = pd.DataFrame(loadings)
        idx_col = None
        for cand in ["variable", "col", "column", "feature", "name"]:
            if cand in dfL.columns:
                idx_col = cand
                break
        if idx_col:
            dfL = dfL.set_index(idx_col)

        factor_cols = [c for c in dfL.columns if str(c).lower().startswith("factor")]
        if not factor_cols:
            factor_cols = [c for c in dfL.columns if "factor" in str(c).lower()]
        if factor_cols:
            dfL = dfL[factor_cols]
        return dfL

    return None


def _extract_fa_scores(fa: Dict[str, Any]) -> Optional[pd.DataFrame]:
    scores = fa.get("scores") or fa.get("factor_scores")
    if scores is None:
        return None
    if not isinstance(scores, list) or len(scores) == 0:
        return None

    dfS = pd.DataFrame(scores)
    if all(isinstance(c, int) for c in dfS.columns):
        dfS.columns = [f"Factor{i+1}_score" for i in range(dfS.shape[1])]
    else:
        dfS.columns = [str(c).replace(" ", "_") for c in dfS.columns]
    return dfS


def _top_loading_features(loadings: pd.DataFrame, factor_col: str, top_k: int = 5) -> List[Tuple[str, float]]:
    s = pd.to_numeric(loadings[factor_col], errors="coerce").fillna(0.0)
    s = s.reindex(loadings.index)
    ranked = s.abs().sort_values(ascending=False).head(top_k)
    out = []
    for colname in ranked.index.tolist():
        out.append((str(colname), float(s.loc[colname])))
    return out


def _corr(series_a: pd.Series, series_b: pd.Series) -> Optional[float]:
    a = pd.to_numeric(series_a, errors="coerce")
    b = pd.to_numeric(series_b, errors="coerce")
    m = ~(a.isna() | b.isna())
    if m.sum() < 5:
        return None
    try:
        return float(a[m].corr(b[m]))
    except Exception:
        return None


def build_fa_experimental_cards(
    df: pd.DataFrame,
    fa: Dict[str, Any],
    roles: Dict[str, Any],
    selected: Dict[str, Any],
    dims: List[str],
) -> Dict[str, Any]:
    if not fa or not fa.get("ok"):
        return {"ok": False, "reason": fa.get("reason", "FA not available"), "cards": []}

    loadings_df = _extract_fa_loadings(fa)
    scores_df = _extract_fa_scores(fa)

    if loadings_df is None or scores_df is None:
        return {
            "ok": False,
            "reason": "FA ran, but factor loadings/scores were not returned by factor_engine yet. Update run_factor_analysis() to include them.",
            "cards": [],
        }

    revenue_col = _pick_role_col(roles, "REVENUE")
    measure_col = revenue_col if (revenue_col and revenue_col in df.columns) else selected.get("measure")
    if not measure_col or measure_col not in df.columns:
        return {"ok": False, "reason": "No usable measure (Revenue/selected measure) found for FA alignment.", "cards": []}

    if len(scores_df) != len(df):
        n = min(len(scores_df), len(df))
        scores_df = scores_df.iloc[:n].reset_index(drop=True)
        df2 = df.iloc[:n].reset_index(drop=True)
    else:
        df2 = df

    cards: List[Dict[str, Any]] = []

    factor_score_cols = [c for c in scores_df.columns if "factor" in str(c).lower()]
    if not factor_score_cols:
        factor_score_cols = list(scores_df.columns)

    corr_rows = []
    for fcol in factor_score_cols:
        c = _corr(scores_df[fcol], df2[measure_col])
        if c is None:
            continue
        corr_rows.append({"factor": fcol, "corr_with_measure": c})

    if not corr_rows:
        return {"ok": False, "reason": "Factor scores exist, but correlation to measure is not computable (too many missing/non-numeric).", "cards": []}

    corr_df = pd.DataFrame(corr_rows).sort_values("corr_with_measure", key=lambda s: s.abs(), ascending=False)
    best_factor = str(corr_df.iloc[0]["factor"])
    best_corr = float(corr_df.iloc[0]["corr_with_measure"])

    load_factor_cols = list(loadings_df.columns)
    load_factor = None
    for lf in load_factor_cols:
        if str(lf).lower().replace(" ", "_") in str(best_factor).lower():
            load_factor = lf
            break
    if load_factor is None:
        load_factor = load_factor_cols[0]

    top_feats = _top_loading_features(loadings_df, load_factor, top_k=5)

    tableA = [{"rank": i + 1, "feature": feat, "loading": round(val, 4)} for i, (feat, val) in enumerate(top_feats)]
    cards.append(_make_card(
        title="Experimental driver signal (FA-based)",
        why=f"Factor most aligned with '{measure_col}'. corr={best_corr:.3f}. Top loading features explain what this factor is capturing.",
        table=tableA,
        chart={"type": "bar", "x": "feature", "y": "loading"},
    ))

    factor_series = pd.to_numeric(scores_df[best_factor], errors="coerce")
    seg_rows: List[Dict[str, Any]] = []

    for dim in dims[:3]:
        if dim not in df2.columns:
            continue
        tmp = pd.DataFrame({dim: df2[dim], "factor_score": factor_series})
        tmp = tmp.dropna(subset=[dim])
        if len(tmp) == 0:
            continue
        out = (
            tmp.groupby(dim, dropna=False)["factor_score"]
            .mean()
            .sort_values(ascending=False)
            .head(8)
            .reset_index()
        )
        for _, r in out.iterrows():
            seg_rows.append({
                "dimension": dim,
                "segment": str(r[dim]),
                "avg_factor_score": float(r["factor_score"]),
            })

    if seg_rows:
        seg_df = pd.DataFrame(seg_rows).sort_values("avg_factor_score", ascending=False).head(15)
        cards.append(_make_card(
            title="Top segments associated with the driver (FA-based)",
            why="These segments have the highest average factor score, meaning they are most associated with the discovered driver pattern.",
            table=seg_df.to_dict(orient="records"),
            chart={"type": "bar", "x": "segment", "y": "avg_factor_score"},
        ))

    tmp = pd.DataFrame({"factor_score": factor_series, "measure": pd.to_numeric(df2[measure_col], errors="coerce")}).dropna()
    if len(tmp) >= 20:
        try:
            tmp["bin"] = pd.qcut(tmp["factor_score"], q=5, duplicates="drop")
            out = tmp.groupby("bin")["measure"].mean().reset_index()
            out["bin"] = out["bin"].astype(str)
            cards.append(_make_card(
                title="Does the driver predict the measure? (FA-based)",
                why="Factor score is binned into quantiles. If average measure rises with higher bins, the factor is a useful business signal.",
                table=out.to_dict(orient="records"),
                chart={"type": "line", "x": "bin", "y": "measure"},
            ))
        except Exception:
            pass

    return {"ok": True, "reason": None, "cards": cards}


# ----------------------------
# main API
# ----------------------------

def generate_insights(
    df: pd.DataFrame,
    semantic: Dict[str, Any],
    measure_override: Optional[str] = None,

    # ✅ accept both singular + plural (for compatibility with main.py)
    dimension_override: Optional[str] = None,
    dimension_overrides: Optional[List[str]] = None,
    dimensions_override: Optional[List[str]] = None,

    time_override: Optional[str] = None,
    cards_selected: Optional[List[str]] = None,
    roles: Optional[Dict[str, Any]] = None,
    business_names_map: Optional[Dict[str, Any]] = None,
    fa: Optional[Dict[str, Any]] = None,
    **kwargs: Any,  # ✅ swallow any future/extra args safely
) -> Dict[str, Any]:
    roles = roles or {}
    business_names_map = business_names_map or {}

    # Normalize dimension overrides into ONE list
    dims_override_list: Optional[List[str]] = None
    if dimension_overrides:
        dims_override_list = list(dimension_overrides)
    elif dimensions_override:
        dims_override_list = list(dimensions_override)
    elif dimension_override:
        dims_override_list = [dimension_override]

    measure = _choose_measure(df, semantic, roles, measure_override)
    time_col = _choose_time(df, semantic, roles, time_override)
    dims = _choose_dimensions(df, semantic, roles, dims_override_list, measure_col=measure, max_dims=3)

    selected = {
        "measure": measure,
        "time": time_col,
        "dimensions": dims,
        "dimension": (dims[0] if dims else None),
    }

    summary = build_kpi_summary(df=df, roles=roles, selected=selected)

    def want(cid: str) -> bool:
        if not cards_selected:
            return True
        return cid in set(cards_selected)

    cards: List[Dict[str, Any]] = []

    if not measure or measure not in df.columns:
        return {
            "selected": selected,
            "cards": [],
            "kpi_summary": summary,
            "naming": business_names_map,
            "experimental": {"ok": False, "reason": "No usable measure column for standard insights.", "cards": []},
        }

    if dims and want("top_dimension_by_measure"):
        dim = dims[0]
        if dim in df.columns:
            table = _topn_table(df, group_col=dim, measure_col=measure, n=10)
            cards.append(_make_card(
                title=f"Top {dim} by {measure}",
                why=f"Shows what contributes most to {measure}. Useful for focus and prioritization.",
                table=table,
                chart={"type": "bar", "x": dim, "y": measure},
                card_id="top_dimension_by_measure",
            ))

    if time_col and time_col in df.columns and want("measure_over_time_daily"):
        table = _time_agg(df, time_col=time_col, measure_col=measure, freq="D")
        cards.append(_make_card(
            title=f"{measure} trend (daily)",
            why="Daily trend helps spot spikes, dips, and unusual behavior.",
            table=table,
            chart={"type": "line", "x": "time", "y": measure},
            card_id="measure_over_time_daily",
        ))

    if time_col and time_col in df.columns and want("measure_over_time_monthly"):
        table = _time_agg(df, time_col=time_col, measure_col=measure, freq="M")
        cards.append(_make_card(
            title=f"{measure} trend (monthly)",
            why="Monthly trend is better for strategic planning and seasonality.",
            table=table,
            chart={"type": "line", "x": "time", "y": measure},
            card_id="measure_over_time_monthly",
        ))

    if want("measure_distribution"):
        table = _distribution_table(df, measure_col=measure)
        cards.append(_make_card(
            title=f"{measure} distribution",
            why="Distribution helps detect skew, outliers, and typical ranges.",
            table=table,
            chart={"type": "bar", "x": "metric", "y": "value"},
            card_id="measure_distribution",
        ))

    if dims and want("measure_by_category"):
        dim = dims[1] if len(dims) > 1 else dims[0]
        if dim in df.columns:
            table = _topn_table(df, group_col=dim, measure_col=measure, n=12)
            cards.append(_make_card(
                title=f"{measure} by {dim}",
                why="Breakdown by category-like field is a classic analyst view for strategy decisions.",
                table=table,
                chart={"type": "bar", "x": dim, "y": measure},
                card_id="measure_by_category",
            ))

    experimental = {"ok": False, "reason": "FA not provided.", "cards": []}
    if fa is not None:
        experimental = build_fa_experimental_cards(
            df=df,
            fa=fa,
            roles=roles,
            selected=selected,
            dims=dims,
        )

    return {
        "selected": selected,
        "cards": cards,
        "kpi_summary": summary,
        "naming": business_names_map,
        "experimental": experimental,
    }
