import os
import sys

# Set up paths first
backend_dir = r"C:\SLIIT\Y4S2\RP\Implementation\rp-project\backend"
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

# Load environment variables
from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, ".env"))

from app.modules.vishva.tools import extract_menu_data
import json

url = "https://tilapiyacolombo.lk/menu/"
output_dir = r"C:\SLIIT\Y4S2\RP\Implementation\rp-project\backend\app\modules\vishva\data\raw"

print("Starting extraction...")
result = extract_menu_data(url, output_dir)
print("__RESULT_JSON__")
print(json.dumps(result, indent=2))
