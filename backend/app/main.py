from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.scores import router as scores_router
from app.database import engine
from app.models import Base
from dotenv import load_dotenv
import os
import uvicorn

load_dotenv()

app = FastAPI(title="Music Site API")

# CORS configuration
frontend_host = os.getenv("FRONTEND_HOST", "127.0.0.1")
frontend_port = os.getenv("FRONTEND_PORT", "3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[f"http://{frontend_host}:{frontend_port}"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create database tables
Base.metadata.create_all(bind=engine)

# Register routes
app.include_router(scores_router, prefix="/api/scores", tags=["scores"])

@app.get("/")
async def root():
    return {"message": "Welcome to Music Site API"}

if __name__ == "__main__":
    backend_host = os.getenv("BACKEND_HOST", "127.0.0.1")
    backend_port = int(os.getenv("BACKEND_PORT", 8000))
    uvicorn.run("main:app", host=backend_host, port=backend_port, reload=True)