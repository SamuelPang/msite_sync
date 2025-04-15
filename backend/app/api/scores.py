 
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas import ScoreCreate, ScoreResponse, ScoreUpdate
from app.crud import create_score, get_score, update_score
from app.database import get_db
from app.score.processor import ScoreProcessor
from app.score.exporter import ScoreExporter

router = APIRouter()

@router.post("/", response_model=ScoreResponse)
def create_new_score(score: ScoreCreate, db: Session = Depends(get_db)):
    return create_score(db, score)

@router.get("/{score_id}", response_model=ScoreResponse)
def read_score(score_id: int, db: Session = Depends(get_db)):
    db_score = get_score(db, score_id)
    if db_score is None:
        raise HTTPException(status_code=404, detail="Score not found")
    return db_score

@router.put("/{score_id}", response_model=ScoreResponse)
def update_existing_score(score_id: int, score: ScoreUpdate, db: Session = Depends(get_db)):
    db_score = update_score(db, score_id, score)
    if db_score is None:
        raise HTTPException(status_code=404, detail="Score not found")
    return db_score

@router.post("/{score_id}/play")
def play_score_segment(score_id: int, track_id: int, start: float, end: float, db: Session = Depends(get_db)):
    db_score = get_score(db, score_id)
    if db_score is None:
        raise HTTPException(status_code=404, detail="Score not found")
    score = ScoreProcessor.create_score(db_score.data)
    segment = ScoreProcessor.get_segment(score, track_id, start, end)
    return {"segment": [str(n) for n in segment.flat.notes]}

@router.post("/{score_id}/export")
def export_score(score_id: int, track_id: int, start: float, end: float, format: str, db: Session = Depends(get_db)):
    db_score = get_score(db, score_id)
    if db_score is None:
        raise HTTPException(status_code=404, detail="Score not found")
    score = ScoreProcessor.create_score(db_score.data)
    segment = ScoreProcessor.get_segment(score, track_id, start, end)
    output_path = ScoreExporter.export_to_audio(segment, format)
    return {"file_path": output_path}