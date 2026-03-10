"""
SQL Vector Learning System
==========================

A retrieval-augmented SQL generation system that:
1. Stores accepted/corrected SQL queries as embeddings in a vector database
2. Retrieves similar past cases for new requests
3. Uses them as few-shot examples to improve SQL generation

Architecture:
- Embedding: sentence-transformers (all-MiniLM-L6-v2)
- Vector DB: FAISS (local, no external dependencies)
- Retrieval: Top-k similar cases based on context similarity
"""

from __future__ import annotations

import json
import hashlib
import numpy as np
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict

# Vector database storage path
_BASE_DIR = Path(__file__).resolve().parents[2] / "ml"
_BASE_DIR.mkdir(parents=True, exist_ok=True)
VECTOR_DB_PATH = _BASE_DIR / "sql_vector_store.json"
EMBEDDINGS_PATH = _BASE_DIR / "sql_embeddings.npy"

# Try to import sentence-transformers and FAISS
try:
    from sentence_transformers import SentenceTransformer
    EMBEDDINGS_AVAILABLE = True
except ImportError:
    EMBEDDINGS_AVAILABLE = False
    SentenceTransformer = None

try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False
    faiss = None


@dataclass
class SQLCase:
    """A single SQL case stored in the vector database."""
    id: str
    # Context for embedding
    card_type: str           # e.g., "top_dimension_by_measure"
    chart_type: str          # e.g., "bar", "line"
    intent: str              # e.g., "Show top 10 regions by revenue"
    schema_summary: str      # e.g., "columns: Region(str), Revenue(float), Date(datetime)"
    
    # The SQL
    original_sql: str        # System-generated SQL
    corrected_sql: str       # User-corrected SQL (the ground truth)
    
    # Metadata
    dataset_name: str
    feedback: Optional[str]  # User's explanation of what was wrong
    created_at: str
    
    def to_embedding_text(self) -> str:
        """Create text representation for embedding."""
        return f"""Card Type: {self.card_type}
Chart Type: {self.chart_type}
Intent: {self.intent}
Schema: {self.schema_summary}
Task: Generate SQL query for this visualization"""

    def to_prompt_example(self) -> str:
        """Format as a few-shot example for prompting."""
        return f"""### Example
Intent: {self.intent}
Schema: {self.schema_summary}
Correct SQL:
```sql
{self.corrected_sql}
```"""


class SQLVectorStore:
    """
    Vector store for SQL cases using FAISS.
    
    Stores SQL corrections as embeddings and retrieves similar cases
    for few-shot prompting.
    """
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.model = None
        self.index = None
        self.cases: List[SQLCase] = []
        self.embeddings: Optional[np.ndarray] = None
        self.embedding_dim = 384  # Default for MiniLM
        
        # Load existing data
        self._load()
    
    def _ensure_model(self) -> bool:
        """Lazy load the embedding model."""
        if not EMBEDDINGS_AVAILABLE:
            return False
        if self.model is None:
            try:
                self.model = SentenceTransformer(self.model_name)
                self.embedding_dim = self.model.get_sentence_embedding_dimension()
            except Exception as e:
                print(f"Failed to load embedding model: {e}")
                return False
        return True
    
    def _ensure_index(self) -> bool:
        """Ensure FAISS index is initialized."""
        if not FAISS_AVAILABLE:
            return False
        if self.index is None:
            self.index = faiss.IndexFlatIP(self.embedding_dim)  # Inner product for cosine similarity
            if self.embeddings is not None and len(self.embeddings) > 0:
                # Normalize for cosine similarity
                normalized = self.embeddings / np.linalg.norm(self.embeddings, axis=1, keepdims=True)
                self.index.add(normalized.astype(np.float32))
        return True
    
    def _generate_id(self, case_data: Dict[str, Any]) -> str:
        """Generate a unique ID for a case."""
        content = f"{case_data.get('card_type', '')}-{case_data.get('corrected_sql', '')}-{datetime.utcnow().isoformat()}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    def _load(self) -> None:
        """Load cases and embeddings from disk."""
        # Load cases
        if VECTOR_DB_PATH.exists():
            try:
                with VECTOR_DB_PATH.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.cases = [SQLCase(**case) for case in data.get("cases", [])]
            except Exception as e:
                print(f"Failed to load vector store: {e}")
                self.cases = []
        
        # Load embeddings
        if EMBEDDINGS_PATH.exists():
            try:
                self.embeddings = np.load(EMBEDDINGS_PATH)
            except Exception:
                self.embeddings = None
    
    def _save(self) -> None:
        """Save cases and embeddings to disk."""
        # Save cases
        data = {"cases": [asdict(case) for case in self.cases]}
        with VECTOR_DB_PATH.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        # Save embeddings
        if self.embeddings is not None and len(self.embeddings) > 0:
            np.save(EMBEDDINGS_PATH, self.embeddings)
    
    def add_case(
        self,
        card_type: str,
        chart_type: str,
        intent: str,
        columns: List[str],
        column_types: Optional[Dict[str, str]] = None,
        original_sql: str = "",
        corrected_sql: str = "",
        dataset_name: str = "",
        feedback: Optional[str] = None,
    ) -> Optional[SQLCase]:
        """
        Add a new SQL case to the vector store.
        
        Args:
            card_type: Type of insight card (e.g., "top_dimension_by_measure")
            chart_type: Type of chart (e.g., "bar", "line")
            intent: Natural language description of what the SQL should do
            columns: List of column names in the dataset
            column_types: Optional dict mapping column names to types
            original_sql: The system-generated SQL
            corrected_sql: The user-corrected SQL
            dataset_name: Name of the dataset
            feedback: Optional user feedback about the correction
            
        Returns:
            The created SQLCase, or None if failed
        """
        # Build schema summary
        if column_types:
            schema_parts = [f"{col}({column_types.get(col, 'unknown')})" for col in columns[:10]]
        else:
            schema_parts = columns[:10]
        schema_summary = "columns: " + ", ".join(schema_parts)
        if len(columns) > 10:
            schema_summary += f" ... (+{len(columns) - 10} more)"
        
        # Create case
        case = SQLCase(
            id=self._generate_id({"card_type": card_type, "corrected_sql": corrected_sql}),
            card_type=card_type,
            chart_type=chart_type,
            intent=intent,
            schema_summary=schema_summary,
            original_sql=original_sql,
            corrected_sql=corrected_sql,
            dataset_name=dataset_name,
            feedback=feedback,
            created_at=datetime.utcnow().isoformat(),
        )
        
        # Generate embedding
        if self._ensure_model():
            try:
                embedding = self.model.encode(case.to_embedding_text())
                embedding = embedding / np.linalg.norm(embedding)  # Normalize
                
                if self.embeddings is None:
                    self.embeddings = embedding.reshape(1, -1)
                else:
                    self.embeddings = np.vstack([self.embeddings, embedding])
                
                # Update FAISS index
                if self._ensure_index():
                    self.index.add(embedding.reshape(1, -1).astype(np.float32))
            except Exception as e:
                print(f"Failed to generate embedding: {e}")
        
        self.cases.append(case)
        self._save()
        
        return case
    
    def search_similar(
        self,
        card_type: str,
        chart_type: str,
        intent: str,
        columns: List[str],
        top_k: int = 3,
    ) -> List[Tuple[SQLCase, float]]:
        """
        Search for similar SQL cases.
        
        Args:
            card_type: Type of insight card
            chart_type: Type of chart
            intent: Natural language description
            columns: List of column names
            top_k: Number of results to return
            
        Returns:
            List of (SQLCase, similarity_score) tuples
        """
        if not self.cases:
            return []
        
        # If we have embeddings and FAISS, use vector search
        if (self._ensure_model() and self._ensure_index() and 
            self.embeddings is not None and len(self.embeddings) > 0):
            
            # Build query text
            schema_summary = "columns: " + ", ".join(columns[:10])
            query_text = f"""Card Type: {card_type}
Chart Type: {chart_type}
Intent: {intent}
Schema: {schema_summary}
Task: Generate SQL query for this visualization"""
            
            try:
                # Generate query embedding
                query_embedding = self.model.encode(query_text)
                query_embedding = query_embedding / np.linalg.norm(query_embedding)
                query_embedding = query_embedding.reshape(1, -1).astype(np.float32)
                
                # Search
                k = min(top_k, len(self.cases))
                scores, indices = self.index.search(query_embedding, k)
                
                results = []
                for score, idx in zip(scores[0], indices[0]):
                    if idx < len(self.cases):
                        results.append((self.cases[idx], float(score)))
                
                return results
            except Exception as e:
                print(f"Vector search failed: {e}")
        
        # Fallback: simple text matching
        return self._fallback_search(card_type, chart_type, top_k)
    
    def _fallback_search(
        self,
        card_type: str,
        chart_type: str,
        top_k: int,
    ) -> List[Tuple[SQLCase, float]]:
        """Fallback search using simple matching."""
        results = []
        
        for case in self.cases:
            score = 0.0
            if case.card_type == card_type:
                score += 0.5
            if case.chart_type == chart_type:
                score += 0.3
            if score > 0:
                results.append((case, score))
        
        # Sort by score descending
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]
    
    def get_few_shot_prompt(
        self,
        card_type: str,
        chart_type: str,
        intent: str,
        columns: List[str],
        top_k: int = 3,
        min_similarity: float = 0.3,
    ) -> str:
        """
        Generate a few-shot prompt with similar examples.
        
        Args:
            card_type: Type of insight card
            chart_type: Type of chart
            intent: Natural language description
            columns: List of column names
            top_k: Maximum number of examples
            min_similarity: Minimum similarity threshold
            
        Returns:
            Formatted prompt with examples
        """
        similar_cases = self.search_similar(
            card_type=card_type,
            chart_type=chart_type,
            intent=intent,
            columns=columns,
            top_k=top_k,
        )
        
        # Filter by similarity threshold
        similar_cases = [(case, score) for case, score in similar_cases if score >= min_similarity]
        
        if not similar_cases:
            return ""
        
        prompt_parts = ["Here are similar SQL queries that were previously corrected:\n"]
        
        for i, (case, score) in enumerate(similar_cases, 1):
            prompt_parts.append(f"--- Example {i} (similarity: {score:.2f}) ---")
            prompt_parts.append(case.to_prompt_example())
            prompt_parts.append("")
        
        prompt_parts.append("Use these examples as reference for generating the correct SQL.\n")
        
        return "\n".join(prompt_parts)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the vector store."""
        if not self.cases:
            return {
                "total_cases": 0,
                "has_embeddings": False,
                "embedding_model": self.model_name,
                "faiss_available": FAISS_AVAILABLE,
                "embeddings_available": EMBEDDINGS_AVAILABLE,
            }
        
        card_types = {}
        chart_types = {}
        datasets = set()
        
        for case in self.cases:
            card_types[case.card_type] = card_types.get(case.card_type, 0) + 1
            chart_types[case.chart_type] = chart_types.get(case.chart_type, 0) + 1
            datasets.add(case.dataset_name)
        
        return {
            "total_cases": len(self.cases),
            "has_embeddings": self.embeddings is not None and len(self.embeddings) > 0,
            "embedding_dim": self.embedding_dim,
            "embedding_model": self.model_name,
            "faiss_available": FAISS_AVAILABLE,
            "embeddings_available": EMBEDDINGS_AVAILABLE,
            "by_card_type": card_types,
            "by_chart_type": chart_types,
            "unique_datasets": len(datasets),
        }
    
    def clear(self) -> int:
        """Clear all cases from the store."""
        count = len(self.cases)
        self.cases = []
        self.embeddings = None
        self.index = None
        self._save()
        return count


# Global instance
_vector_store: Optional[SQLVectorStore] = None


def get_vector_store() -> SQLVectorStore:
    """Get the global vector store instance."""
    global _vector_store
    if _vector_store is None:
        _vector_store = SQLVectorStore()
    return _vector_store


# Convenience functions

def add_sql_case(
    card_type: str,
    chart_type: str,
    intent: str,
    columns: List[str],
    column_types: Optional[Dict[str, str]] = None,
    original_sql: str = "",
    corrected_sql: str = "",
    dataset_name: str = "",
    feedback: Optional[str] = None,
) -> Optional[SQLCase]:
    """Add a SQL case to the vector store."""
    store = get_vector_store()
    return store.add_case(
        card_type=card_type,
        chart_type=chart_type,
        intent=intent,
        columns=columns,
        column_types=column_types,
        original_sql=original_sql,
        corrected_sql=corrected_sql,
        dataset_name=dataset_name,
        feedback=feedback,
    )


def search_similar_sql(
    card_type: str,
    chart_type: str,
    intent: str,
    columns: List[str],
    top_k: int = 3,
) -> List[Tuple[SQLCase, float]]:
    """Search for similar SQL cases."""
    store = get_vector_store()
    return store.search_similar(
        card_type=card_type,
        chart_type=chart_type,
        intent=intent,
        columns=columns,
        top_k=top_k,
    )


def get_sql_few_shot_prompt(
    card_type: str,
    chart_type: str,
    intent: str,
    columns: List[str],
    top_k: int = 3,
) -> str:
    """Generate a few-shot prompt with similar examples."""
    store = get_vector_store()
    return store.get_few_shot_prompt(
        card_type=card_type,
        chart_type=chart_type,
        intent=intent,
        columns=columns,
        top_k=top_k,
    )


def get_vector_store_stats() -> Dict[str, Any]:
    """Get statistics about the vector store."""
    store = get_vector_store()
    return store.get_stats()
