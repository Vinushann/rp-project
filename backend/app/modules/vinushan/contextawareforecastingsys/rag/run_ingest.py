"""Quick script to run knowledge base ingestion."""
import sys
import os
from pathlib import Path

# Add the vinushan module dir to path
MODULE_DIR = Path(__file__).resolve().parent.parent.parent  # vinushan/
sys.path.insert(0, str(MODULE_DIR))

# Load env manually
env_path = MODULE_DIR.parent.parent.parent / ".env"
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=env_path, override=True)

from contextawareforecastingsys.rag.ingest import ingest_knowledge_base

if __name__ == "__main__":
    print("Ingesting knowledge base...")
    result = ingest_knowledge_base(force=True)
    print(f"Result: {result}")
