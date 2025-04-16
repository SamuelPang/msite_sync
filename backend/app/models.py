from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

class Score(Base):
    __tablename__ = "scores"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    tracks = relationship("Track", back_populates="score")

class Track(Base):
    __tablename__ = "tracks"
    
    id = Column(Integer, primary_key=True, index=True)
    score_id = Column(Integer, ForeignKey("scores.id"))
    
    score = relationship("Score", back_populates="tracks")
    notes = relationship("Note", back_populates="track")

class Note(Base):
    __tablename__ = "notes"
    
    id = Column(Integer, primary_key=True, index=True)
    track_id = Column(Integer, ForeignKey("tracks.id"))
    pitch = Column(String)
    duration = Column(String)
    
    track = relationship("Track", back_populates="notes")