"""Context-aware forecasting package bootstrap for Vinushan module."""

from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent
MODULE_ROOT = BASE_DIR.parent
CONFIG_DIR = BASE_DIR / "config"
DATA_DIR = MODULE_ROOT / "data"
REPORTS_DIR = MODULE_ROOT / "reports"

# Ensure resource folders exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

# Seed defaults without overriding existing env
os.environ.setdefault(
	"SALES_DATA_PATH", str(DATA_DIR / "the_rossmann_coffee_shop_sales_dataset.csv")
)
os.environ.setdefault("BUSINESS_NAME", "Rossmann Coffee Shop")
os.environ.setdefault("BUSINESS_LOCATION", "Katunayake / Negombo, Sri Lanka")
os.environ.setdefault("HISTORY_YEARS", "4")

__all__ = [
	"BASE_DIR",
	"MODULE_ROOT",
	"CONFIG_DIR",
	"DATA_DIR",
	"REPORTS_DIR",
]
