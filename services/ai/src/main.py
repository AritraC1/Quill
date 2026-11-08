from fastapi import FastAPI
from recommender.api import router as recommender_router

app = FastAPI(title="Quill AI Service", version="0.1.0")

app.include_router(recommender_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

