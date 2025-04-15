 
from pydantic import BaseModel
from typing import Dict, Optional

class ScoreCreate(BaseModel):
    title: str
    data: Dict

class ScoreUpdate(BaseModel):
    title: Optional[str] = None
    data: Optional[Dict] = None

class ScoreResponse(BaseModel):
    id: int
    title: str
    data: Dict

    class Config:
        orm_mode = True