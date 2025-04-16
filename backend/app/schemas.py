from pydantic import BaseModel
from typing import List

class Note(BaseModel):
    pitch: str  # e.g., "c/4"
    duration: str  # e.g., "q"

    class Config:
        orm_mode = True

class Track(BaseModel):
    notes: List[Note]

    class Config:
        orm_mode = True

class ScoreBase(BaseModel):
    title: str
    tracks: List[Track]

class ScoreCreate(ScoreBase):
    pass

class Score(ScoreBase):
    id: int

    class Config:
        orm_mode = True