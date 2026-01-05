import sqlite3
import json
from pathlib import Path
from typing import Any, Dict, Optional


# Store the SQLite DB next to this file so it works
# regardless of the current working directory.
_DB_DIR = Path(__file__).resolve().parent
_DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = str(_DB_DIR / "kpi.db")


def init_db() -> None:
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS kpi_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        kpi_type TEXT NOT NULL,  -- traditional | smart
        formula_json TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS kpi_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dataset_name TEXT NOT NULL,
        results_json TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    )
    """)

    con.commit()
    con.close()


def save_kpi_definition(name: str, kpi_type: str, formula: Dict[str, Any]) -> None:
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute(
        "INSERT INTO kpi_definitions (name, kpi_type, formula_json) VALUES (?, ?, ?)",
        (name, kpi_type, json.dumps(formula)),
    )
    con.commit()
    con.close()


def save_run(dataset_name: str, results: Dict[str, Any]) -> None:
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute(
        "INSERT INTO kpi_runs (dataset_name, results_json) VALUES (?, ?)",
        (dataset_name, json.dumps(results, default=str)),
    )
    con.commit()
    con.close()


def get_latest_run() -> Optional[Dict[str, Any]]:
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("SELECT results_json FROM kpi_runs ORDER BY id DESC LIMIT 1")
    row = cur.fetchone()
    con.close()
    if not row:
        return None
    return json.loads(row[0])
