"""Service FastAPI minimal pour interroger le corpus factice."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

ROOT = Path(__file__).resolve().parent
INDEX_PATH = ROOT / "indexes" / "corpus.json"

app = FastAPI(title="Assistant IA (POC)")


class QueryRequest(BaseModel):
    question: str
    top_k: int = 3


class AnswerChunk(BaseModel):
    id: str
    source: str
    score: float
    content: str
    metadata: dict


class QueryResponse(BaseModel):
    question: str
    answers: List[AnswerChunk]


@lru_cache(maxsize=1)
def _load_corpus() -> list[dict]:
    if not INDEX_PATH.exists():
        raise FileNotFoundError(f"Corpus introuvable: {INDEX_PATH}")
    with INDEX_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _build_vectorizer():
    corpus = _load_corpus()
    documents = [entry["content"] for entry in corpus]
    vectorizer = TfidfVectorizer()
    matrix = vectorizer.fit_transform(documents)
    return vectorizer, matrix


@app.post("/query", response_model=QueryResponse)
def query_endpoint(payload: QueryRequest) -> QueryResponse:
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="La question est vide")

    corpus = _load_corpus()
    vectorizer, matrix = _build_vectorizer()
    question_vec = vectorizer.transform([question])
    scores = cosine_similarity(question_vec, matrix)[0]

    top_indices = scores.argsort()[::-1][: payload.top_k]
    answers = [
        AnswerChunk(
            id=corpus[idx]["id"],
            source=corpus[idx]["source"],
            score=float(scores[idx]),
            content=corpus[idx]["content"],
            metadata=corpus[idx]["metadata"],
        )
        for idx in top_indices
    ]

    return QueryResponse(question=question, answers=answers)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("service:app", host="0.0.0.0", port=8000, reload=True)
