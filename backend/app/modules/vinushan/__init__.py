"""Vinushan module bootstrap.

Adds the module directory to ``sys.path`` so the bundled
``contextawareforecastingsys`` package can be imported without extra
packaging steps. Also seeds sensible defaults for data/report paths so the
module works out of the box in the shared backend.
"""

from pathlib import Path
import os
import sys

MODULE_ROOT = Path(__file__).resolve().parent

# Ensure local packages (contextawareforecastingsys, etc.) are importable
if str(MODULE_ROOT) not in sys.path:
	sys.path.append(str(MODULE_ROOT))

# Default resource locations
DATA_DIR = MODULE_ROOT / "data"
REPORTS_DIR = MODULE_ROOT / "reports"

DATA_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

# Environment defaults (preserve user overrides)
os.environ.setdefault(
	"SALES_DATA_PATH",
	str(DATA_DIR / "the_rossmann_coffee_shop_sales_dataset.csv"),
)
os.environ.setdefault("BUSINESS_NAME", "Rossmann Coffee Shop")
os.environ.setdefault("BUSINESS_LOCATION", "Katunayake / Negombo, Sri Lanka")
os.environ.setdefault("HISTORY_YEARS", "4")
