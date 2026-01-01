"""
Vishva Module Router
====================

OWNER: Vishva
DESCRIPTION: Menu Extraction & Category Classification System

This router handles all endpoints for the Vishva component.
All routes are automatically prefixed with /api/v1/vishva

ENDPOINTS:
- GET  /ping           - Health check for this module
- POST /extract        - Extract menu data from a URL
- POST /train          - Train the category classifier
- POST /predict        - Predict categories for menu items
- GET  /menu-data      - Get the current menu data
- GET  /model-status   - Get model training status/info
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.schemas import PingResponse, ChatRequest, ChatResponse
import os
import json
import csv
import io

# Get the module directory path
MODULE_DIR = os.path.dirname(os.path.abspath(__file__))

router = APIRouter()

MODULE_NAME = "vishva"


# ============================================
# SCHEMAS
# ============================================

class ExtractRequest(BaseModel):
    """Request to extract menu from a URL"""
    url: str

class ExtractResponse(BaseModel):
    """Response from menu extraction"""
    success: bool
    message: str
    item_count: Optional[int] = 0
    raw_file: Optional[str] = None
    clean_file: Optional[str] = None

class TrainRequest(BaseModel):
    """Request to train the model"""
    training_file: Optional[str] = None  # Use default if not provided

class TrainResponse(BaseModel):
    """Response from model training"""
    success: bool
    message: str
    best_model: Optional[str] = None
    accuracy: Optional[float] = None
    f1_score: Optional[float] = None
    categories: Optional[List[str]] = None

class MenuItem(BaseModel):
    """A single menu item (name, price, category only - no description for POS)"""
    name: str
    price: Optional[str] = ""
    category: Optional[str] = None

class PredictRequest(BaseModel):
    """Request to predict categories"""
    items: List[MenuItem]

class PredictedItem(BaseModel):
    """A menu item with prediction (no description for POS)"""
    name: str
    price: Optional[str] = ""
    predicted_category: str
    confidence: float
    all_probabilities: Optional[Dict[str, float]] = None

class PredictResponse(BaseModel):
    """Response from category prediction"""
    success: bool
    message: str
    predictions: Optional[List[PredictedItem]] = None
    statistics: Optional[Dict[str, Any]] = None

class ModelStatus(BaseModel):
    """Model status information"""
    model_exists: bool
    model_name: Optional[str] = None
    accuracy: Optional[float] = None
    f1_score: Optional[float] = None
    categories: Optional[List[str]] = None
    trained_at: Optional[str] = None


# ============================================
# ENDPOINTS
# ============================================

@router.get("/ping", response_model=PingResponse)
async def ping():
    """
    Health check endpoint for Vishva module.
    Returns module name and status.
    """
    return PingResponse(module=MODULE_NAME, status="ok")


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat endpoint for Vishva module.
    """
    reply = f"Vishva Module: Menu Extraction & Classification System. Send a URL to /extract to get started!"
    
    return ChatResponse(
        reply=reply,
        session_id=request.session_id,
        module=MODULE_NAME
    )


@router.post("/extract", response_model=ExtractResponse)
async def extract_menu(request: ExtractRequest):
    """
    Extract menu data from a restaurant website.
    
    This uses browser automation to scrape menu items including:
    - Item name
    - Price
    - Description
    - Category (if visible)
    
    Runs in a subprocess to avoid event loop conflicts with the local browser.
    """
    import subprocess
    import sys
    
    try:
        from app.modules.vishva.tools import clean_json_data
        
        # Create a temporary script to run extraction in separate process
        extract_script = os.path.join(MODULE_DIR, "_run_extract.py")
        output_dir = os.path.join(MODULE_DIR, "data/raw")
        
        # Write a temporary extraction script
        script_content = f'''
import sys
import os
sys.path.insert(0, r"{os.path.dirname(os.path.dirname(os.path.dirname(MODULE_DIR)))}")
os.chdir(r"{os.path.dirname(os.path.dirname(os.path.dirname(MODULE_DIR)))}")

from app.modules.vishva.tools import extract_menu_data
import json

result = extract_menu_data(r"{request.url}", r"{output_dir}")
print("__RESULT_JSON__")
print(json.dumps(result))
'''
        
        with open(extract_script, 'w') as f:
            f.write(script_content)
        
        # Run in subprocess (this works like your standalone script)
        python_exe = sys.executable
        result = subprocess.run(
            [python_exe, extract_script],
            capture_output=True,
            text=True,
            cwd=os.path.dirname(os.path.dirname(os.path.dirname(MODULE_DIR))),
            timeout=300  # 5 minute timeout
        )
        
        # Clean up temp script
        try:
            os.remove(extract_script)
        except:
            pass
        
        # Parse result from subprocess output
        output = result.stdout
        if "__RESULT_JSON__" in output:
            json_str = output.split("__RESULT_JSON__")[1].strip()
            extraction_result = json.loads(json_str)
        else:
            return ExtractResponse(
                success=False,
                message=f"Extraction subprocess failed: {result.stderr or 'No output'}",
                item_count=0
            )
        
        if not extraction_result["success"]:
            return ExtractResponse(
                success=False,
                message=f"Extraction failed: {extraction_result['message']}",
                item_count=0
            )
        
        # Clean the extracted data
        cleaning_result = clean_json_data(
            input_file=extraction_result['file_path'],
            output_dir=os.path.join(MODULE_DIR, "output")
        )
        
        if not cleaning_result["success"]:
            return ExtractResponse(
                success=False,
                message=f"Cleaning failed: {cleaning_result['message']}",
                item_count=0,
                raw_file=extraction_result['file_path']
            )
        
        return ExtractResponse(
            success=True,
            message="Menu extracted and cleaned successfully",
            item_count=cleaning_result['item_count'],
            raw_file=extraction_result['file_path'],
            clean_file=cleaning_result['main_file']
        )
        
    except ImportError as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Required dependencies not installed: {str(e)}. Install browser-use and langchain-anthropic."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/train", response_model=TrainResponse)
async def train_model(request: TrainRequest):
    """
    Train the menu category classifier.
    
    Uses the cleaned menu data to train ML models and selects the best one.
    Models tested: SVM, Logistic Regression, Naive Bayes
    """
    try:
        from app.modules.vishva.tools import train_category_classifier
        
        # Use default training file if not provided
        training_file = request.training_file or os.path.join(MODULE_DIR, "output/menu_data.json")
        
        if not os.path.exists(training_file):
            return TrainResponse(
                success=False,
                message=f"Training file not found: {training_file}. Run extraction first."
            )
        
        # Train the model
        result = train_category_classifier(
            training_file=training_file,
            output_dir=os.path.join(MODULE_DIR, "models")
        )
        
        if not result["success"]:
            return TrainResponse(
                success=False,
                message=result.get("message", "Training failed")
            )
        
        return TrainResponse(
            success=True,
            message="Model trained successfully",
            best_model=result['best_model']['name'],
            accuracy=result['best_model']['accuracy'],
            f1_score=result['best_model']['f1_score'],
            categories=result['categories']
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/predict", response_model=PredictResponse)
async def predict_categories(request: PredictRequest):
    """
    Predict categories for menu items.
    
    Takes a list of menu items and returns predictions with confidence scores.
    """
    try:
        from app.modules.vishva.tools.predict_tool import load_model_components, predict_single_item
        
        model_dir = os.path.join(MODULE_DIR, "models")
        
        # Load model components
        try:
            components = load_model_components(model_dir)
        except FileNotFoundError as e:
            return PredictResponse(
                success=False,
                message=str(e),
                predictions=None
            )
        
        # Predict for each item
        predictions = []
        total_confidence = 0
        
        for item in request.items:
            item_dict = {
                'name': item.name,
                'price': item.price or ''
            }
            
            result = predict_single_item(item_dict, components)
            
            predictions.append(PredictedItem(
                name=result['name'],
                price=result.get('price', ''),
                predicted_category=result['predicted_category'],
                confidence=result['confidence'],
                all_probabilities=result.get('all_probabilities')
            ))
            
            total_confidence += result['confidence']
        
        avg_confidence = total_confidence / len(predictions) if predictions else 0
        
        return PredictResponse(
            success=True,
            message=f"Predicted categories for {len(predictions)} items",
            predictions=predictions,
            statistics={
                'total_items': len(predictions),
                'average_confidence': avg_confidence
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/predict-file")
async def predict_from_file(file: UploadFile = File(...)):
    """
    Predict categories from an uploaded file (CSV or PDF).
    
    CSV format: Should have a column named 'name' or 'product' or 'item' containing product names.
    PDF format: Will extract text and parse product names (one per line).
    
    Returns predictions that can be exported to CSV, PDF, or JSON.
    """
    try:
        from app.modules.vishva.tools.predict_tool import load_model_components, predict_single_item
        
        model_dir = os.path.join(MODULE_DIR, "models")
        
        # Load model components
        try:
            components = load_model_components(model_dir)
        except FileNotFoundError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # Read file content
        content = await file.read()
        filename = file.filename.lower()
        
        items = []
        
        if filename.endswith('.csv'):
            # Parse CSV file
            try:
                text_content = content.decode('utf-8')
                csv_reader = csv.DictReader(io.StringIO(text_content))
                
                # Find the name column (could be 'name', 'product', 'item', 'product_name', etc.)
                fieldnames = csv_reader.fieldnames or []
                name_column = None
                price_column = None
                
                for field in fieldnames:
                    field_lower = field.lower().strip()
                    if field_lower in ['name', 'product', 'item', 'product_name', 'item_name', 'productname']:
                        name_column = field
                    if field_lower in ['price', 'cost', 'amount', 'value']:
                        price_column = field
                
                if not name_column:
                    # Try first column as name
                    if fieldnames:
                        name_column = fieldnames[0]
                    else:
                        raise HTTPException(status_code=400, detail="CSV must have a column for product names")
                
                for row in csv_reader:
                    name = row.get(name_column, '').strip()
                    price = row.get(price_column, '').strip() if price_column else ''
                    if name:
                        items.append({'name': name, 'price': price})
                        
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")
                
        elif filename.endswith('.pdf'):
            # Parse PDF file
            try:
                import fitz  # PyMuPDF
                
                pdf_document = fitz.open(stream=content, filetype="pdf")
                text = ""
                for page in pdf_document:
                    text += page.get_text()
                pdf_document.close()
                
                # Parse lines as product names
                lines = text.split('\n')
                for line in lines:
                    line = line.strip()
                    if line and len(line) > 2 and len(line) < 200:  # Filter out too short or too long lines
                        # Try to extract price if present (e.g., "Product Name - Rs. 1000" or "Product Name 1000")
                        items.append({'name': line, 'price': ''})
                        
            except ImportError:
                raise HTTPException(status_code=400, detail="PDF support requires PyMuPDF. Install with: pip install PyMuPDF")
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Please upload a CSV or PDF file.")
        
        if not items:
            raise HTTPException(status_code=400, detail="No product names found in the file")
        
        # Predict categories for all items
        predictions = []
        total_confidence = 0
        
        for item in items:
            result = predict_single_item(item, components)
            predictions.append({
                'name': result['name'],
                'price': result.get('price', ''),
                'predicted_category': result['predicted_category'],
                'confidence': result['confidence']
            })
            total_confidence += result['confidence']
        
        avg_confidence = total_confidence / len(predictions) if predictions else 0
        
        return {
            "success": True,
            "message": f"Predicted categories for {len(predictions)} items from {file.filename}",
            "predictions": predictions,
            "statistics": {
                "total_items": len(predictions),
                "average_confidence": avg_confidence,
                "source_file": file.filename
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export-predictions")
async def export_predictions(
    predictions: List[Dict[str, Any]],
    format: str = "json"
):
    """
    Export predictions to CSV, PDF, or JSON format.
    """
    try:
        if format.lower() == "json":
            return {
                "success": True,
                "data": predictions,
                "format": "json"
            }
            
        elif format.lower() == "csv":
            output = io.StringIO()
            if predictions:
                fieldnames = ['name', 'price', 'predicted_category', 'confidence']
                writer = csv.DictWriter(output, fieldnames=fieldnames)
                writer.writeheader()
                for pred in predictions:
                    writer.writerow({
                        'name': pred.get('name', ''),
                        'price': pred.get('price', ''),
                        'predicted_category': pred.get('predicted_category', ''),
                        'confidence': f"{pred.get('confidence', 0) * 100:.1f}%"
                    })
            
            output.seek(0)
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=predictions.csv"}
            )
            
        elif format.lower() == "pdf":
            try:
                from reportlab.lib import colors
                from reportlab.lib.pagesizes import letter, A4
                from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
                from reportlab.lib.styles import getSampleStyleSheet
                
                buffer = io.BytesIO()
                doc = SimpleDocTemplate(buffer, pagesize=A4)
                elements = []
                
                styles = getSampleStyleSheet()
                elements.append(Paragraph("Category Predictions Report", styles['Heading1']))
                elements.append(Spacer(1, 20))
                
                # Create table data
                table_data = [['Product Name', 'Price', 'Category', 'Confidence']]
                for pred in predictions:
                    table_data.append([
                        pred.get('name', '')[:50],  # Truncate long names
                        pred.get('price', ''),
                        pred.get('predicted_category', ''),
                        f"{pred.get('confidence', 0) * 100:.1f}%"
                    ])
                
                table = Table(table_data, colWidths=[200, 80, 120, 70])
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 1), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ]))
                
                elements.append(table)
                doc.build(elements)
                
                buffer.seek(0)
                return StreamingResponse(
                    buffer,
                    media_type="application/pdf",
                    headers={"Content-Disposition": "attachment; filename=predictions.pdf"}
                )
                
            except ImportError:
                raise HTTPException(status_code=400, detail="PDF export requires reportlab. Install with: pip install reportlab")
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {format}. Use 'json', 'csv', or 'pdf'.")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/menu-data")
async def get_menu_data():
    """
    Get the current extracted menu data.
    """
    menu_file = os.path.join(MODULE_DIR, "output/menu_data.json")
    
    if not os.path.exists(menu_file):
        return {
            "success": False,
            "message": "No menu data found. Run extraction first.",
            "items": []
        }
    
    try:
        with open(menu_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return {
            "success": True,
            "message": f"Found {len(data)} menu items",
            "items": data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/model-status", response_model=ModelStatus)
async def get_model_status():
    """
    Get the current model status and information.
    """
    model_file = os.path.join(MODULE_DIR, "models/best_model.pkl")
    results_file = os.path.join(MODULE_DIR, "models/model_results.json")
    
    if not os.path.exists(model_file):
        return ModelStatus(
            model_exists=False,
            model_name=None,
            accuracy=None,
            f1_score=None,
            categories=None,
            trained_at=None
        )
    
    # Load model results
    model_info = {}
    if os.path.exists(results_file):
        try:
            with open(results_file, 'r', encoding='utf-8') as f:
                model_info = json.load(f)
        except:
            pass
    
    # Extract best model info - JSON has 'model' field not 'name'
    best_model = model_info.get('best_model', {})
    model_name = best_model.get('model', 'Unknown')
    # Add vectorizer and feature selector for more context
    vectorizer = best_model.get('vectorizer', '')
    feature_selector = best_model.get('feature_selector', '')
    if vectorizer and feature_selector:
        model_name = f"{model_name} ({vectorizer} + {feature_selector})"
    
    accuracy = best_model.get('accuracy')
    
    # F1 score - check best_model first (new format), then fall back to all_results (old format)
    f1_score = best_model.get('f1_score')
    if f1_score is None:
        all_results = model_info.get('all_results', [])
        if all_results:
            # Find the best model in all_results to get its f1_score
            for result in all_results:
                if (result.get('vectorizer') == best_model.get('vectorizer') and
                    result.get('feature_selector') == best_model.get('feature_selector') and
                    result.get('model') == best_model.get('model')):
                    f1_score = result.get('f1_score')
                    break
            # Fallback: use first result's f1_score
            if f1_score is None and all_results:
                f1_score = all_results[0].get('f1_score')
    
    # Get categories from label encoder if exists
    categories = model_info.get('categories')
    if not categories:
        # Try to load from label encoder
        label_encoder_file = os.path.join(MODULE_DIR, "models/label_encoder.pkl")
        if os.path.exists(label_encoder_file):
            try:
                import pickle
                with open(label_encoder_file, 'rb') as f:
                    le = pickle.load(f)
                    categories = list(le.classes_)
            except:
                pass
    
    # Use timestamp as trained_at
    trained_at = model_info.get('trained_at') or model_info.get('timestamp')
    
    return ModelStatus(
        model_exists=True,
        model_name=model_name,
        accuracy=accuracy,
        f1_score=f1_score,
        categories=categories,
        trained_at=trained_at
    )


# ============================================
# STREAMING EXTRACTION ENDPOINT (SSE)
# ============================================

from fastapi.responses import StreamingResponse
import subprocess
import sys
import threading

# Global tracking for running extraction processes
_active_extraction = {
    "process": None,
    "running": False,
    "stop_requested": False,
    "lock": threading.Lock()
}


@router.post("/extract-stop")
async def stop_extraction():
    """
    Stop the currently running extraction agent.
    Uses taskkill on Windows to kill the entire process tree including browser.
    """
    import platform
    
    with _active_extraction["lock"]:
        if _active_extraction["process"] is not None and _active_extraction["running"]:
            _active_extraction["stop_requested"] = True
            try:
                process = _active_extraction["process"]
                pid = process.pid
                
                if platform.system() == "Windows":
                    # On Windows, use taskkill to kill the entire process tree
                    import subprocess as sp
                    sp.run(['taskkill', '/F', '/T', '/PID', str(pid)], 
                           capture_output=True, check=False)
                else:
                    # On Unix, kill process group
                    import signal
                    try:
                        os.killpg(os.getpgid(pid), signal.SIGTERM)
                    except:
                        process.kill()
                
                # Clean up
                _active_extraction["process"] = None
                _active_extraction["running"] = False
                
                return {"success": True, "message": "Extraction stopped"}
            except Exception as e:
                # Force cleanup even on error
                _active_extraction["process"] = None
                _active_extraction["running"] = False
                _active_extraction["stop_requested"] = False
                return {"success": False, "message": f"Failed to stop: {str(e)}"}
        else:
            return {"success": False, "message": "No extraction is currently running"}


@router.get("/extract-status")
async def get_extraction_status():
    """
    Get the current extraction status.
    """
    with _active_extraction["lock"]:
        return {
            "running": _active_extraction["running"],
            "stop_requested": _active_extraction["stop_requested"]
        }


@router.get("/extract-stream")
async def extract_menu_stream(url: str):
    """
    Stream menu extraction with real-time agent thoughts via Server-Sent Events.
    
    Use this endpoint to see what the agent is thinking as it extracts data.
    """
    import queue
    import threading
    
    def generate_sync():
        """Synchronous generator that yields SSE data"""
        output_queue = queue.Queue()
        process = None
        reader_thread = None
        
        try:
            from app.modules.vishva.tools import clean_json_data
            
            # Create extraction script
            extract_script = os.path.join(MODULE_DIR, "_run_extract_stream.py")
            output_dir = os.path.join(MODULE_DIR, "data/raw")
            backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(MODULE_DIR)))
            
            script_content = f'''
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

sys.path.insert(0, r"{backend_dir}")
os.chdir(r"{backend_dir}")

from app.modules.vishva.tools.extract_tool import extract_menu_data
import json

result = extract_menu_data(r"{url}", r"{output_dir}")
print("__RESULT_JSON__")
print(json.dumps(result))
'''
            
            with open(extract_script, 'w', encoding='utf-8') as f:
                f.write(script_content)
            
            yield f"data: {json.dumps({'type': 'status', 'message': 'Starting extraction agent...'})}\n\n"
            yield f"data: {json.dumps({'type': 'status', 'message': f'Target URL: {url}'})}\n\n"
            
            # Run subprocess
            python_exe = sys.executable
            env = os.environ.copy()
            env['PYTHONUNBUFFERED'] = '1'
            
            process = subprocess.Popen(
                [python_exe, '-u', extract_script],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=0,
                cwd=backend_dir,
                env=env
            )
            
            # Track the process globally so it can be stopped
            with _active_extraction["lock"]:
                _active_extraction["process"] = process
                _active_extraction["running"] = True
                _active_extraction["stop_requested"] = False
            
            # Thread to read stdout and put lines in queue
            def reader():
                try:
                    for line in iter(process.stdout.readline, b''):
                        output_queue.put(line.decode('utf-8', errors='replace').rstrip())
                except:
                    pass
                finally:
                    output_queue.put(None)  # Signal end
            
            reader_thread = threading.Thread(target=reader, daemon=True)
            reader_thread.start()
            
            result_json = None
            capturing_result = False
            result_lines = []
            was_stopped = False
            
            # Read from queue with timeout
            while True:
                # Check if stop was requested
                with _active_extraction["lock"]:
                    if _active_extraction["stop_requested"]:
                        was_stopped = True
                        break
                
                try:
                    line = output_queue.get(timeout=0.3)
                    
                    if line is None:
                        # Process ended
                        break
                    
                    if "__RESULT_JSON__" in line:
                        capturing_result = True
                        continue
                    
                    if capturing_result:
                        result_lines.append(line)
                    elif line.strip():
                        yield f"data: {json.dumps({'type': 'thought', 'message': line})}\n\n"
                        
                except queue.Empty:
                    # Timeout - check if process has ended
                    if process.poll() is not None:
                        # Drain remaining items from queue
                        while True:
                            try:
                                line = output_queue.get_nowait()
                                if line is None:
                                    break
                                if "__RESULT_JSON__" in line:
                                    capturing_result = True
                                    continue
                                if capturing_result:
                                    result_lines.append(line)
                                elif line.strip():
                                    yield f"data: {json.dumps({'type': 'thought', 'message': line})}\n\n"
                            except queue.Empty:
                                break
                        break
            
            # Clean up process tracking
            with _active_extraction["lock"]:
                _active_extraction["process"] = None
                _active_extraction["running"] = False
            
            # Handle stopped case
            if was_stopped:
                try:
                    os.remove(extract_script)
                except:
                    pass
                yield f"data: {json.dumps({'type': 'stopped', 'success': False, 'message': 'Extraction was stopped by user'})}\n\n"
                return
            
            # Parse final result
            if result_lines:
                try:
                    result_json = json.loads(''.join(result_lines))
                except json.JSONDecodeError:
                    result_json = {"success": False, "message": "Failed to parse result"}
            else:
                result_json = {"success": False, "message": "No result from extraction"}
            
            # Clean up
            try:
                os.remove(extract_script)
            except:
                pass
            
            if result_json.get("success"):
                yield f"data: {json.dumps({'type': 'status', 'message': 'Extraction complete! Cleaning data...'})}\n\n"
                
                # Clean the data
                cleaning_result = clean_json_data(
                    input_file=result_json['file_path'],
                    output_dir=os.path.join(MODULE_DIR, "output")
                )
                
                if cleaning_result["success"]:
                    item_count = cleaning_result['item_count']
                    msg = f"Successfully extracted {item_count} items"
                    yield f"data: {json.dumps({'type': 'complete', 'success': True, 'message': msg, 'item_count': item_count})}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'complete', 'success': False, 'message': cleaning_result['message']})}\n\n"
            else:
                err_msg = result_json.get('message', 'Extraction failed')
                yield f"data: {json.dumps({'type': 'complete', 'success': False, 'message': err_msg})}\n\n"
                
        except Exception as e:
            import traceback
            yield f"data: {json.dumps({'type': 'error', 'message': str(e) + ' - ' + traceback.format_exc()})}\n\n"
        finally:
            # Ensure cleanup
            with _active_extraction["lock"]:
                _active_extraction["process"] = None
                _active_extraction["running"] = False
    
    return StreamingResponse(
        generate_sync(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
    )
