"""
Ayathma Module Router
=====================

OWNER: Ayathma
DESCRIPTION: Smart KPI Analyzer - AI-powered KPI extraction from datasets

This router handles all endpoints for the Ayathma component.
All routes are automatically prefixed with /api/v1/ayathma

ENDPOINTS:
- GET  /ping     - Health check for this module
- POST /analyze  - Analyze a dataset and extract KPIs
- GET  /download/{format} - Download results in JSON/CSV/report format
"""

from __future__ import annotations

import io
import json
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, UploadFile, File, Form, Body
from fastapi.responses import Response, JSONResponse
from fastapi.encoders import jsonable_encoder
import pandas as pd

from app.schemas import PingResponse

# Import services from the app subfolder
from app.modules.ayathma.app.db.repo import init_db, save_kpi_definition, save_run, get_latest_run
from app.modules.ayathma.app.services.data_prep import clean_and_profile
from app.modules.ayathma.app.services.factor_engine import run_factor_analysis
from app.modules.ayathma.app.services.smart_kpis import create_smart_kpis
from app.modules.ayathma.app.services.semantic_profile import build_semantic_profile
from app.modules.ayathma.app.services.traditional_kpis import compute_generic_kpis
from app.modules.ayathma.app.services.exporter import results_to_csv_bytes
from app.modules.ayathma.app.services.insights import generate_insights
from app.modules.ayathma.app.services.role_mapper import infer_roles, business_names
from app.modules.ayathma.app.services.training_logger import (
    append_training_example,
    load_training_examples,
    delete_training_examples_for_dataset,
)
from app.modules.ayathma.app.services.trainer import train_recommender_from_jsonl

# Optional ML recommender
try:
    from app.modules.ayathma.app.services.feature_builder import build_dataset_features
    from app.modules.ayathma.app.services.ml_recommender import recommend_pack_and_cards
    ML_AVAILABLE = True
except Exception:
    ML_AVAILABLE = False
    build_dataset_features = None
    recommend_pack_and_cards = None

router = APIRouter()
MODULE_NAME = "ayathma"

# Initialize database on module load
try:
    init_db()
except Exception:
    pass  # DB init might fail if path doesn't exist yet


def _rolepick_to_dict(roles: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Convert RolePick objects to plain dicts for serialization."""
    out: Dict[str, Any] = {}
    for role, pick in (roles or {}).items():
        if pick is None:
            out[role] = None
        else:
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


@router.get("/ping", response_model=PingResponse)
async def ping():
    """Health check endpoint for Ayathma module."""
    return PingResponse(module=MODULE_NAME, status="ok")


@router.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    measure_col: Optional[str] = Form(None),
    dimension_col: Optional[str] = Form(None),
    time_col: Optional[str] = Form(None),
):
    """
    Analyze a dataset and extract KPIs.
    
    Args:
        file: CSV or Excel file to analyze
        measure_col: Optional override for measure column
        dimension_col: Optional override for dimension column
        time_col: Optional override for time column
        
    Returns:
        JSON with analysis results including KPIs, insights, and profiles
    """
    warnings: List[str] = []

    content = await file.read()

    # Try CSV first, then Excel
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception:
        try:
            df = pd.read_excel(io.BytesIO(content))
        except Exception as e:
            return JSONResponse(
                {"ok": False, "error": f"Could not read file: {str(e)}"},
                status_code=400
            )

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
            warnings.append(f"ML recommender failed: {type(e).__name__}: {e}")
            ml_features = None
            ml_rec = None
            cards_selected = None
    else:
        warnings.append("ML recommender not available. Using heuristic insights.")

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

    # Use jsonable_encoder so dates, datetimes, and other
    # non-JSON-native types (e.g. numpy types) are serialized safely.
    payload = jsonable_encoder({"ok": True, "results": results})
    return JSONResponse(payload)


@router.post("/training/examples")
async def create_training_example(payload: Dict[str, Any] = Body(...)):
    """Save a labeled training example for the KPI recommender.

    The frontend is expected to send a payload shaped like:

        {
          "dataset_id": str,
          "pack": str,
          "columns": [...],
          "features": {...},  # typically results["ml_features"]
          "roles": {...},     # typically results["role_inference"]
          "cards": [...],     # list of card IDs (e.g. "measure_over_time_daily")
        }
    """
    dataset_id = str(payload.get("dataset_id") or "").strip()
    pack = str(payload.get("pack") or "").strip()
    if not dataset_id or not pack:
        return JSONResponse({"ok": False, "error": "dataset_id and pack are required"}, status_code=400)

    example = {
        "dataset_id": dataset_id,
        "pack": pack,
        "columns": payload.get("columns") or [],
        "features": payload.get("features") or {},
        "roles": payload.get("roles") or {},
        "cards": payload.get("cards") or [],
    }

    append_training_example(example)
    return JSONResponse({"ok": True, "saved": True, "example": {"dataset_id": dataset_id, "pack": pack}})


@router.get("/training/examples")
def list_training_examples():
    """Return all stored training examples.

    This is primarily for the Training Management UI.
    """
    items = load_training_examples()
    return {"ok": True, "items": items}


@router.delete("/training/examples/{dataset_id}")
def delete_training_examples(dataset_id: str):
    """Delete all training examples for a given dataset_id."""
    removed = delete_training_examples_for_dataset(dataset_id)
    return {"ok": True, "removed": removed}


@router.post("/training/retrain")
def retrain_recommender():
    """Retrain the KPI recommender model from stored training data.

    This is a management endpoint intended to be called from the
    Training tab in the Ayathma UI. It can be slow for large
    training sets because it runs scikit-learn in-process.
    """
    try:
        summary = train_recommender_from_jsonl()
        return {"ok": True, "summary": summary}
    except Exception as e:
        return JSONResponse(
            {"ok": False, "error": f"Training failed: {type(e).__name__}: {e}"},
            status_code=500,
        )


@router.get("/download/{format}")
def download_results(format: str):
    """
    Download the latest analysis results.
    
    Args:
        format: 'json', 'csv', or 'report'
        
    Returns:
        File download response
    """
    results = get_latest_run()
    if not results:
        return Response("No results available yet. Run an analysis first.", status_code=404)

    if format == "json":
        payload = json.dumps(results, indent=2, default=str).encode("utf-8")
        return Response(
            content=payload,
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=kpi_analysis.json"},
        )
    elif format == "csv":
        csv_bytes = results_to_csv_bytes(results)
        return Response(
            content=csv_bytes,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=kpi_analysis.csv"},
        )
    elif format == "report":
        report = json.dumps(results, indent=2, default=str)
        return Response(
            content=report.encode("utf-8"),
            media_type="text/plain",
            headers={"Content-Disposition": "attachment; filename=kpi_analysis.txt"},
        )
    else:
        return Response(f"Unknown format: {format}", status_code=400)
