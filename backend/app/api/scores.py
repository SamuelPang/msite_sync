from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from music21 import stream, tempo
from app import crud, schemas
from app.database import get_db
from app.score.processor import ScoreProcessor
from app.score.exporter import ScoreExporter
from app.dependencies import EXPORT_DIR
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/", response_model=schemas.Score)
def create_score(score: schemas.ScoreCreate, db: Session = Depends(get_db)):
    logger.info(f"Creating score: {score.dict()}")
    return crud.create_score(db=db, score=score)

@router.get("/{score_id}", response_model=schemas.Score)
def read_score(score_id: int, db: Session = Depends(get_db)):
    db_score = crud.get_score(db=db, score_id=score_id)
    if db_score is None:
        raise HTTPException(status_code=404, detail="Score not found")
    return db_score

@router.post("/{score_id}/export")
def export_score(score_id: int, payload: dict, db: Session = Depends(get_db)):
    """
    Export a score to MusicXML or MP3 format.
    Payload: {track_id: int, start: int, end: int, format: str, instrument: str, tempo: int}
    Returns: {file_path: str}
    """
    logger.info(f"Exporting score {score_id} with payload: {payload}")

    # Validate payload
    track_id = payload.get("track_id")
    start = payload.get("start")
    end = payload.get("end")
    format = payload.get("format")
    tempo_bpm = payload.get("tempo", 120)  # Default to 120 BPM if not provided

    if not isinstance(track_id, int) or track_id < 0:
        raise HTTPException(status_code=400, detail="Invalid track_id")
    if not isinstance(start, int) or not isinstance(end, int) or start < 0 or end < start:
        raise HTTPException(status_code=400, detail="Invalid start or end")
    if format not in ["musicxml", "mp3"]:
        raise HTTPException(status_code=400, detail="Invalid format")
    if not isinstance(tempo_bpm, (int, float)) or tempo_bpm < 1:
        raise HTTPException(status_code=400, detail="Invalid tempo")

    # Fetch score
    db_score = crud.get_score(db=db, score_id=score_id)
    if db_score is None:
        raise HTTPException(status_code=404, detail="Score not found")
    if track_id >= len(db_score.tracks):
        raise HTTPException(status_code=400, detail="Invalid track_id")

    # Convert to dictionary manually to avoid nested ORM mapping issues
    score_data = {
        "title": db_score.title,
        "tracks": [
            {
                "notes": [
                    {"pitch": note.pitch, "duration": note.duration}
                    for note in track.notes
                ]
            }
            for track in db_score.tracks
        ]
    }
    logger.info(f"Total notes in track {track_id}: {len(score_data['tracks'][track_id]['notes'])}")

    # Convert to music21 score
    score = ScoreProcessor.create_score(score_data)
    logger.info(f"Number of elements in full score: {len(list(score.flat.notesAndRests))}")

    # Get segment
    segment = ScoreProcessor.get_segment(score, track_id, start, end)
    logger.info(f"Number of elements in segment: {len(list(segment))}")

    # Create a new score with the segment
    export_score = stream.Score()
    part = stream.Part()
    for element in segment:
        part.append(element)
    export_score.append(part)
    logger.info(f"Number of elements in export score: {len(list(export_score.flat.notesAndRests))}")

    # Add tempo to the score
    tempo_marking = tempo.MetronomeMark(number=tempo_bpm)
    export_score.insert(0, tempo_marking)
    logger.info(f"Applied tempo: {tempo_bpm} BPM")

    # Export to requested format
    try:
        if format == "musicxml":
            file_path = ScoreExporter.export_to_musicxml(export_score)
        elif format == "mp3":
            instrument = payload.get("instrument", "piano")
            file_path = ScoreExporter.export_to_audio(export_score, format="mp3", instrument_name=instrument)

        # Return relative path (relative to project root)
        relative_path = os.path.relpath(file_path, os.path.dirname(__file__))
        return {"file_path": relative_path}
    except Exception as e:
        logger.error(f"Error exporting score: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to export score: {str(e)}")