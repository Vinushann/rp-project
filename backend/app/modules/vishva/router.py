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

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.schemas import PingResponse, ChatRequest, ChatResponse
import os
import json

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
    """A single menu item"""
    name: str
    price: Optional[str] = ""
    description: Optional[str] = ""
    category: Optional[str] = None

class PredictRequest(BaseModel):
    """Request to predict categories"""
    items: List[MenuItem]

class PredictedItem(BaseModel):
    """A menu item with prediction"""
    name: str
    price: Optional[str] = ""
    description: Optional[str] = ""
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
            json_file=training_file,
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
                'price': item.price or '',
                'description': item.description or ''
            }
            
            result = predict_single_item(item_dict, components)
            
            predictions.append(PredictedItem(
                name=result['name'],
                price=result.get('price', ''),
                description=result.get('description', ''),
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
    
    return ModelStatus(
        model_exists=True,
        model_name=model_info.get('best_model', {}).get('name', 'Unknown'),
        accuracy=model_info.get('best_model', {}).get('accuracy'),
        f1_score=model_info.get('best_model', {}).get('f1_score'),
        categories=model_info.get('categories'),
        trained_at=model_info.get('trained_at')
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
    """
    with _active_extraction["lock"]:
        if _active_extraction["process"] is not None and _active_extraction["running"]:
            _active_extraction["stop_requested"] = True
            try:
                _active_extraction["process"].terminate()
                # Give it a moment, then force kill if needed
                try:
                    _active_extraction["process"].wait(timeout=3)
                except subprocess.TimeoutExpired:
                    _active_extraction["process"].kill()
                return {"success": True, "message": "Extraction stopped"}
            except Exception as e:
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
    
    async def generate():
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

from app.modules.vishva.tools import extract_menu_data
import json

result = extract_menu_data(r"{url}", r"{output_dir}")
print("__RESULT_JSON__")
print(json.dumps(result))
'''
            
            with open(extract_script, 'w', encoding='utf-8') as f:
                f.write(script_content)
            
            yield f"data: {json.dumps({'type': 'status', 'message': 'Starting extraction agent...'})}\n\n"
            yield f"data: {json.dumps({'type': 'status', 'message': f'Target URL: {url}'})}\n\n"
            
            # Run subprocess with real-time output streaming
            python_exe = sys.executable
            env = os.environ.copy()
            env['PYTHONUNBUFFERED'] = '1'  # Force unbuffered output
            
            process = subprocess.Popen(
                [python_exe, '-u', extract_script],  # -u for unbuffered
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                cwd=backend_dir,
                encoding='utf-8',
                errors='replace',
                env=env
            )
            
            # Track the process globally so it can be stopped
            with _active_extraction["lock"]:
                _active_extraction["process"] = process
                _active_extraction["running"] = True
                _active_extraction["stop_requested"] = False
            
            result_json = None
            capturing_result = False
            result_lines = []
            was_stopped = False
            
            # Stream output line by line
            for line in iter(process.stdout.readline, ''):
                # Check if stop was requested
                with _active_extraction["lock"]:
                    if _active_extraction["stop_requested"]:
                        was_stopped = True
                        break
                
                if not line:
                    break
                    
                line = line.rstrip()
                
                if "__RESULT_JSON__" in line:
                    capturing_result = True
                    continue
                
                if capturing_result:
                    result_lines.append(line)
                else:
                    # Stream agent thoughts to frontend
                    if line.strip():
                        yield f"data: {json.dumps({'type': 'thought', 'message': line})}\n\n"
            
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
            
            process.wait()
            
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
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
    )
