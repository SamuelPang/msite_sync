from music21 import stream, note, chord, converter
from typing import Dict

class ScoreProcessor:
    @staticmethod
    def _convert_pitch(vexflow_pitch: str) -> str:
        """
        Convert VexFlow pitch format (e.g., 'c/4') to music21 pitch format (e.g., 'C4').
        """
        note_name, octave = vexflow_pitch.split('/')
        # Capitalize note name and append octave
        music21_pitch = f"{note_name.upper()}{octave}"
        return music21_pitch

    @staticmethod
    def _convert_duration(vexflow_duration: str) -> float:
        """
        Convert VexFlow duration format (e.g., 'q', 'h', 'w') to music21 quarterLength.
        """
        duration_map = {
            'q': 1.0,  # Quarter note = 1 beat
            'h': 2.0,  # Half note = 2 beats
            'w': 4.0   # Whole note = 4 beats
        }
        return duration_map.get(vexflow_duration, 1.0)  # Default to quarter note if unknown

    @staticmethod
    def create_score(data: Dict) -> stream.Score:
        score = stream.Score()
        for track_data in data.get("tracks", []):
            part = stream.Part()
            for note_data in track_data.get("notes", []):
                # Convert pitch and duration
                music21_pitch = ScoreProcessor._convert_pitch(note_data["pitch"])
                music21_duration = ScoreProcessor._convert_duration(note_data["duration"])
                
                n = note.Note(music21_pitch)
                n.quarterLength = music21_duration
                part.append(n)
            score.append(part)
        return score

    @staticmethod
    def get_segment(score: stream.Score, track_id: int, start: float, end: float):
        part = score.parts[track_id]
        return part.getElementsByOffset(start, end)