from fastapi import FastAPI, Request
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from app.api.scores import router as scores_router
from app.database import engine
from app.models import Base
from dotenv import load_dotenv
import os
import uvicorn
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.info("Init backend")

load_dotenv()

app = FastAPI(title="Music Site API")

# Middleware to log all incoming requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Incoming request: {request.method} {request.url}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response

# Temporarily disable CORSMiddleware to isolate the issue
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

logger.info("CORS allowed origins: ['*']")

# Handle OPTIONS for /api/scores and /api/scores/
@app.options("/api/scores")
@app.options("/api/scores/")
async def options_scores():
    logger.info("Handling OPTIONS request for /api/scores")
    headers = {
        "Access-Control-Allow-Origin": "http://127.0.0.1:3003",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }
    return Response(status_code=200, headers=headers)

Base.metadata.create_all(bind=engine)

app.include_router(scores_router, prefix="/api/scores", tags=["scores"])

@app.get("/")
async def root():
    return {"message": "Welcome to Music Site API"}

if __name__ == "__main__":
    backend_host = os.getenv("BACKEND_HOST", "127.0.0.1")
    backend_port = int(os.getenv("BACKEND_PORT", 8080))
    uvicorn.run("main:app", host=backend_host, port=backend_port, reload=True)