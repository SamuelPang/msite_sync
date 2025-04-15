 
from music21 import stream, note, chord, converter
from typing import Dict

class ScoreProcessor:
    @staticmethod
    def create_score(data: Dict) -> stream.Score:
        score = stream.Score()
        for track_data in data.get("tracks", []):
            part = stream.Part()
            for note_data in track_data.get("notes", []):
                n = note.Note(note_data["pitch"])
                n.quarterLength = note_data["duration"]
                part.append(n)
            score.append(part)
        return score

    @staticmethod
    def get_segment(score: stream.Score, track_id: int, start: float, end: float):
        part = score.parts[track_id]
        return part.getElementsByOffset(start, end)