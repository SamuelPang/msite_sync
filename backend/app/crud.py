 
from sqlalchemy.orm import Session
from app.models import Score
from app.schemas import ScoreCreate, ScoreUpdate

def create_score(db: Session, score: ScoreCreate):
    db_score = Score(title=score.title, data=score.data)
    db.add(db_score)
    db.commit()
    db.refresh(db_score)
    return db_score

def get_score(db: Session, score_id: int):
    return db.query(Score).filter(Score.id == score_id).first()

def update_score(db: Session, score_id: int, score: ScoreUpdate):
    db_score = get_score(db, score_id)
    if db_score:
        if score.title:
            db_score.title = score.title
        if score.data:
            db_score.data = score.data
        db.commit()
        db.refresh(db_score)
    return db_score