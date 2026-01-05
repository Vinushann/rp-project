from __future__ import annotations

import io
import json
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Request, Form
from fastapi.responses import HTMLResponse, Response, JSONResponse
from fastapi.templating import Jinja2Templates
import pandas as pd

from app.db.repo import init_db, save_kpi_definition, save_run, get_latest_run
from app.services.data_prep import clean_and_profile
from app.services.factor_engine import run_factor_analysis
from app.services.smart_kpis import create_smart_kpis
from app.services.semantic_profile import build_semantic_profile
from app.services.traditional_kpis import compute_generic_kpis
from app.services.exporter import results_to_csv_bytes
from app.services.insights import generate_insights

from app.services.role_mapper import infer_roles, business_names


# Optional ML recommender (keep app working even if missing)
try:
    from app.services.feature_builder import build_dataset_features
    from app.services.ml_recommender import recommend_pack_and_cards

    ML_AVAILABLE = True
except Exception:
    ML_AVAILABLE = False
    build_dataset_features = None
    recommend_pack_and_cards = None


app = FastAPI(title="KPI Extraction")
templates = Jinja2Templates(directory="app/templates")


def _rolepick_to_dict(roles: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    infer_roles() returns RolePick objects (dataclass) per role.
    We convert to plain dict to serialize cleanly.
    """
    out: Dict[str, Any] = {}
    for role, pick in (roles or {}).items():
        if pick is None:
            out[role] = None
        else:
            # pick.col, pick.score, pick.reason
            out[role] = {
                "col": getattr(pick, "col", None),
                "score": float(getattr(pick, "score", 0.0)),
                "reason": getattr(pick, "reason", ""),
            }
    return out


def _clean_override(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    v = value.strip()
    return v if v else None


def _validate_override(df: pd.DataFrame, col: Optional[str], label: str, warnings: List[str]) -> Optional[str]:
    if col is None:
        return None
    if col not in df.columns:
        warnings.append(f"{label} override '{col}' was ignored (column not found).")
        return None
    return col


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/analyze", response_class=HTMLResponse)
async def analyze(
    request: Request,
    file: UploadFile = File(...),
    measure_col: Optional[str] = Form(None),
    dimension_col: Optional[str] = Form(None),
    time_col: Optional[str] = Form(None),
):
    warnings: List[str] = []

    content = await file.read()

    # Try CSV first, then Excel
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception:
        df = pd.read_excel(io.BytesIO(content))

    # Keep ALL columns for labeling UI later
    all_columns = [str(c) for c in df.columns.tolist()]

    # Clean + profile
    df, profile = clean_and_profile(df)

    # Semantic profile
    semantic = build_semantic_profile(df, datetime_cols=profile.datetime_cols)

    # Traditional KPIs
    traditional = compute_generic_kpis(df, semantic.__dict__)

    # Factor analysis
    try:
        fa = run_factor_analysis(df, n_factors=3)
    except Exception as e:
        fa = {"ok": False, "reason": f"Factor analysis failed: {type(e).__name__}: {e}"}

    # Smart KPIs
    smart = create_smart_kpis(df, fa)

    # Overrides from UI
    measure_override = _clean_override(measure_col)
    dimension_override = _clean_override(dimension_col)
    time_override = _clean_override(time_col)

    # Validate overrides (ignore wrong column names)
    measure_override = _validate_override(df, measure_override, "Measure", warnings)
    dimension_override = _validate_override(df, dimension_override, "Dimension", warnings)
    time_override = _validate_override(df, time_override, "Time", warnings)

    # --- Role inference + business naming layer ---
    roles_raw = infer_roles(df, semantic.__dict__)
    roles = _rolepick_to_dict(roles_raw)

    try:
        names = business_names(roles=roles_raw, semantic=semantic.__dict__)
    except Exception:
        names = {"role_labels": {}, "ui": {}}

    # --- ML recommender (optional) ---
    ml_features: Optional[Dict[str, Any]] = None
    ml_rec: Optional[Dict[str, Any]] = None
    cards_selected: Optional[List[str]] = None

    if ML_AVAILABLE and build_dataset_features and recommend_pack_and_cards:
        try:
            ml_features = build_dataset_features(
                columns=list(df.columns),
                semantic=semantic.__dict__,
                profile=profile.__dict__,
            )
            ml_rec = recommend_pack_and_cards(ml_features)
            if ml_rec and ml_rec.get("cards_selected"):
                cards_selected = list(ml_rec["cards_selected"])
        except Exception as e:
            warnings.append(f"ML recommender failed and was skipped: {type(e).__name__}: {e}")
            ml_features = None
            ml_rec = None
            cards_selected = None
    else:
        warnings.append("ML recommender not available yet (missing files or model). Using heuristic insights.")

    # ✅ KEY FIX: pass fa + roles + names + selected cards into insights
    try:
        insights = generate_insights(
            df=df,
            semantic=semantic.__dict__,
            measure_override=measure_override,
            dimension_override=dimension_override,
            time_override=time_override,
            cards_selected=cards_selected,
            roles=roles,
            business_names_map=names,
            fa=fa,
        )
    except TypeError as e:
        # In case insights.py signature is older
        warnings.append(f"generate_insights signature mismatch: {e}")
        insights = generate_insights(df=df, semantic=semantic.__dict__)

    results: Dict[str, Any] = {
        "dataset_name": file.filename,
        "all_columns": all_columns,
        "profile": profile.__dict__,
        "semantic": semantic.__dict__,
        "traditional_kpis": traditional,
        "factor_analysis": fa,
        "smart_kpis": smart,
        "insights": insights,
        "ui_warnings": warnings,
        "ml_features": ml_features,
        "ml_recommendation": ml_rec,
        "role_inference": roles,
        "business_names": names,
        "overrides": {
            "measure_override": measure_override,
            "dimension_override": dimension_override,
            "time_override": time_override,
        },
    }

    save_run(dataset_name=file.filename, results=results)

    return templates.TemplateResponse("result.html", {"request": request, "results": results})


# -----------------------
# JSON API endpoint (for React/Vite frontend)
# -----------------------

@app.post("/api/analyze")
async def api_analyze(
    file: UploadFile = File(...),
    measure_col: Optional[str] = Form(None),
    dimension_col: Optional[str] = Form(None),
    time_col: Optional[str] = Form(None),
):
    """Same pipeline as /analyze, but returns JSON instead of rendering result.html."""
    warnings: List[str] = []

    content = await file.read()

    # Try CSV first, then Excel
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception:
        df = pd.read_excel(io.BytesIO(content))

    # Keep ALL columns for labeling UI later
    all_columns = [str(c) for c in df.columns.tolist()]

    # Clean + profile
    df, profile = clean_and_profile(df)

    # Semantic profile
    semantic = build_semantic_profile(df, datetime_cols=profile.datetime_cols)

    # Traditional KPIs
    traditional = compute_generic_kpis(df, semantic.__dict__)

    # Factor analysis
    try:
        fa = run_factor_analysis(df, n_factors=3)
    except Exception as e:
        fa = {"ok": False, "reason": f"Factor analysis failed: {type(e).__name__}: {e}"}

    # Smart KPIs
    smart = create_smart_kpis(df, fa)

    # Overrides (optional)
    measure_override = _clean_override(measure_col)
    dimension_override = _clean_override(dimension_col)
    time_override = _clean_override(time_col)

    measure_override = _validate_override(df, measure_override, "Measure", warnings)
    dimension_override = _validate_override(df, dimension_override, "Dimension", warnings)
    time_override = _validate_override(df, time_override, "Time", warnings)

    # Role inference + business naming
    roles_raw = infer_roles(df, semantic.__dict__)
    roles = _rolepick_to_dict(roles_raw)

    try:
        names = business_names(roles=roles_raw, semantic=semantic.__dict__)
    except Exception:
        names = {"role_labels": {}, "ui": {}}

    # Optional ML recommender
    ml_features: Optional[Dict[str, Any]] = None
    ml_rec: Optional[Dict[str, Any]] = None
    cards_selected: Optional[List[str]] = None

    if ML_AVAILABLE and build_dataset_features and recommend_pack_and_cards:
        try:
            ml_features = build_dataset_features(
                columns=list(df.columns),
                semantic=semantic.__dict__,
                profile=profile.__dict__,
            )
            ml_rec = recommend_pack_and_cards(ml_features)
            if ml_rec and ml_rec.get("cards_selected"):
                cards_selected = list(ml_rec["cards_selected"])
        except Exception as e:
            warnings.append(f"ML recommender failed and was skipped: {type(e).__name__}: {e}")
            ml_features = None
            ml_rec = None
            cards_selected = None
    else:
        warnings.append("ML recommender not available yet (missing files or model). Using heuristic insights.")

    # Insights (with FA + roles)
    try:
        insights = generate_insights(
            df=df,
            semantic=semantic.__dict__,
            measure_override=measure_override,
            dimension_override=dimension_override,
            time_override=time_override,
            cards_selected=cards_selected,
            roles=roles,
            business_names_map=names,
            fa=fa,
        )
    except TypeError as e:
        warnings.append(f"generate_insights signature mismatch: {e}")
        insights = generate_insights(df=df, semantic=semantic.__dict__)

    results: Dict[str, Any] = {
        "dataset_name": file.filename,
        "all_columns": all_columns,
        "profile": profile.__dict__,
        "semantic": semantic.__dict__,
        "traditional_kpis": traditional,
        "factor_analysis": fa,
        "smart_kpis": smart,
        "insights": insights,
        "ui_warnings": warnings,
        "ml_features": ml_features,
        "ml_recommendation": ml_rec,
        "role_inference": roles,
        "business_names": names,
        "overrides": {
            "measure_override": measure_override,
            "dimension_override": dimension_override,
            "time_override": time_override,
        },
    }

    save_run(dataset_name=file.filename, results=results)

    return JSONResponse({"ok": True, "results": results})


# -----------------------
# Download endpoints
# -----------------------

@app.get("/download/json")
def download_json():
    results = get_latest_run()
    if not results:
        return Response("No results available yet. Run an analysis first.", status_code=404)

    payload = json.dumps(results, indent=2, default=str).encode("utf-8")
    return Response(
        content=payload,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=smart_kpi_results.json"},
    )


@app.get("/download/csv")
def download_csv():
    results = get_latest_run()
    if not results:
        return Response("No results available yet. Run an analysis first.", status_code=404)

    csv_bytes = results_to_csv_bytes(results)
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=smart_kpi_results.csv"},
    )


@app.get("/download/report")
def download_report():
    results = get_latest_run()
    if not results:
        return Response("No results available yet. Run an analysis first.", status_code=404)

    # Simple report as text for now
    report = json.dumps(results, indent=2, default=str)
    return Response(
        content=report.encode("utf-8"),
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=smart_kpi_report.txt"},
    )


@app.get("/label", response_class=HTMLResponse)
def label_ui(request: Request):
    results = get_latest_run()
    cols = []
    if results and isinstance(results, dict):
        cols = results.get("all_columns") or []
    return templates.TemplateResponse("label.html", {"request": request, "columns": cols})


@app.post("/label", response_class=HTMLResponse)
async def save_labels(
    request: Request,
    measure_col: Optional[str] = Form(None),
    dimension_col: Optional[str] = Form(None),
    time_col: Optional[str] = Form(None),
):
    # Store label mapping (optional feature)
    payload = {
        "measure_col": measure_col,
        "dimension_col": dimension_col,
        "time_col": time_col,
    }
    save_kpi_definition(payload)

    return templates.TemplateResponse(
        "label.html",
        {
            "request": request,
            "columns": [],
            "saved": True,
            "payload": payload,
        },
    )