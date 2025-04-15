 
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.scores import router as scores_router
from app.database import engine
from app.models import Base

app = FastAPI(title="Music Site API")

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 创建数据库表
Base.metadata.create_all(bind=engine)

# 注册路由
app.include_router(scores_router, prefix="/api/scores", tags=["scores"])

@app.get("/")
async def root():
    return {"message": "Welcome to Music Site API"}