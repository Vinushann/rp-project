
import sys
import os
sys.path.insert(0, r"C:\SLIIT\Y4S1\Research\rp-project\backend")
os.chdir(r"C:\SLIIT\Y4S1\Research\rp-project\backend")

from app.modules.vishva.tools import extract_menu_data
import json

result = extract_menu_data(r"https://tilapiyacolombo.lk/menu/", r"C:\SLIIT\Y4S1\Research\rp-project\backend\app\modules\vishva\data/raw")
print("__RESULT_JSON__")
print(json.dumps(result))
