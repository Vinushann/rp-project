"""
RAG Module for ATHENA Context-Aware Forecasting System
======================================================
Provides Retrieval-Augmented Generation capabilities:
- Document ingestion and chunking
- Embedding generation via OpenAI
- Vector storage via ChromaDB
- Semantic retrieval with source citations
"""

from contextawareforecastingsys.rag.rag_service import RAGService

__all__ = ["RAGService"]
