from sqlalchemy.orm import Session, joinedload
from . import models, schemas
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_score(db: Session, score: schemas.ScoreCreate):
    logger.info(f"Creating score with title: {score.title}")
    db_score = models.Score(title=score.title)
    db.add(db_score)
    db.flush()
    
    for track_data in score.tracks:
        logger.info(f"Creating track for score_id: {db_score.id}")
        db_track = models.Track(score_id=db_score.id)
        db.add(db_track)
        db.flush()
        
        for note_data in track_data.notes:
            logger.info(f"Creating note: pitch={note_data.pitch}, duration={note_data.duration}")
            db_note = models.Note(
                track_id=db_track.id,
                pitch=note_data.pitch,
                duration=note_data.duration
            )
            db.add(db_note)
    
    db.commit()
    db.refresh(db_score)
    logger.info(f"Score created with id: {db_score.id}")
    return db_score

def get_score(db: Session, score_id: int):
    return (db.query(models.Score)
            .options(joinedload(models.Score.tracks).joinedload(models.Track.notes))
            .filter(models.Score.id == score_id)
            .first())