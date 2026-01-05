"""
Time Series Model Registry - Singleton pattern for loading Prophet model once.
Ensures the model is loaded at backend startup and reused across all requests.
"""

import json
import os
import pickle
import threading
from pathlib import Path
from typing import Optional

from prophet import Prophet

from .. import MODULE_ROOT


class ProphetModelRegistry:
    """
    Singleton registry for the trained Prophet model.
    Loads the model once and provides access to it throughout the application lifecycle.
    """
    
    _instance: Optional['ProphetModelRegistry'] = None
    _lock: threading.Lock = threading.Lock()
    _initialized: bool = False
    
    # Model paths
    MODEL_DIR = MODULE_ROOT / "models" / "prophet_qty" / "v1"
    MODEL_PATH = MODEL_DIR / "model.pkl"
    METADATA_PATH = MODEL_DIR / "metadata.json"
    
    def __new__(cls) -> 'ProphetModelRegistry':
        """Singleton pattern - ensure only one instance exists."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize the registry (only runs once due to singleton)."""
        if not self._initialized:
            with self._lock:
                if not self._initialized:
                    self._model: Optional[Prophet] = None
                    self._metadata: dict = {}
                    self._load_model()
                    ProphetModelRegistry._initialized = True
    
    def _load_model(self) -> None:
        """Load the Prophet model and metadata from disk."""
        try:
            # Load model
            if self.MODEL_PATH.exists():
                with open(self.MODEL_PATH, 'rb') as f:
                    self._model = pickle.load(f)
                print(f"  ✅ Prophet model loaded from: {self.MODEL_PATH}")
            else:
                print(f"  ⚠️  Prophet model not found at: {self.MODEL_PATH}")
                self._model = None
            
            # Load metadata
            if self.METADATA_PATH.exists():
                with open(self.METADATA_PATH, 'r') as f:
                    self._metadata = json.load(f)
                print(f"  ✅ Model metadata loaded: {self._metadata.get('model_name', 'Unknown')}")
            else:
                self._metadata = {}
                
        except Exception as e:
            print(f"  ❌ Error loading Prophet model: {e}")
            self._model = None
            self._metadata = {}
    
    @property
    def model(self) -> Optional[Prophet]:
        """Get the loaded Prophet model."""
        return self._model
    
    @property
    def metadata(self) -> dict:
        """Get the model metadata."""
        return self._metadata
    
    @property
    def is_loaded(self) -> bool:
        """Check if the model is successfully loaded."""
        return self._model is not None
    
    @property
    def model_name(self) -> str:
        """Get the model name."""
        return self._metadata.get("model_name", "Prophet")
    
    @property
    def model_version(self) -> str:
        """Get the model version."""
        return self._metadata.get("version", "v1")
    
    @property
    def target(self) -> str:
        """Get the target variable name."""
        return self._metadata.get("target", "daily_total_qty")
    
    @property
    def features(self) -> dict:
        """Get the feature configuration used in training."""
        return self._metadata.get("features", {})
    
    @property
    def metrics(self) -> dict:
        """Get the model performance metrics."""
        return self._metadata.get("metrics", {})
    
    def get_regressors(self) -> list:
        """Get the list of regressor features used by the model."""
        features = self.features
        return features.get("regressors", [
            "is_weekend",
            "is_holiday",
            "is_pre_holiday",
            "is_post_holiday",
            "temp_avg",
            "rain_mm",
            "is_rainy",
        ])
    
    def reload(self) -> bool:
        """Force reload the model from disk."""
        with self._lock:
            self._load_model()
            return self.is_loaded
    
    def get_model_info(self) -> dict:
        """Get a summary of the loaded model."""
        return {
            "model_name": self.model_name,
            "version": self.model_version,
            "target": self.target,
            "is_loaded": self.is_loaded,
            "metrics": self.metrics,
            "regressors": self.get_regressors(),
        }


# Global instance for easy access
_registry: Optional[ProphetModelRegistry] = None


def get_model_registry() -> ProphetModelRegistry:
    """Get the global Prophet model registry instance."""
    global _registry
    if _registry is None:
        _registry = ProphetModelRegistry()
    return _registry


def initialize_model_registry() -> bool:
    """
    Initialize the model registry at startup.
    Call this from the FastAPI startup event.
    Returns True if model loaded successfully.
    """
    registry = get_model_registry()
    return registry.is_loaded
