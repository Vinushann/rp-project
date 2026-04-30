
import sys
import os
import io
import logging

# Force UTF-8 encoding for stdout/stderr to handle emojis
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace', line_buffering=True)

# Configure root logger to capture all library logs
for handler in logging.root.handlers[:]:
    logging.root.removeHandler(handler)

logging.basicConfig(
    level=logging.INFO,
    format='%(message)s',
    handlers=[logging.StreamHandler(sys.stdout)],
    force=True
)

# Also configure the browser_use loggers specifically
for logger_name in ['browser_use', 'Agent', 'service', 'tools', 'BrowserSession']:
    logger = logging.getLogger(logger_name)
    logger.setLevel(logging.INFO)
    logger.handlers = []
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter('%(message)s'))
    logger.addHandler(handler)
    logger.propagate = False

sys.path.insert(0, r"C:\SLIIT\Y4S2\RP\Implementation\rp-project\backend")
os.chdir(r"C:\SLIIT\Y4S2\RP\Implementation\rp-project\backend")

from app.modules.vishva.tools.extract_tool import extract_menu_data
import json

url = os.environ["_EXTRACT_URL"]
output_dir = os.environ["_EXTRACT_OUTPUT_DIR"]
result = extract_menu_data(url, output_dir)
print("__RESULT_JSON__")
print(json.dumps(result))
