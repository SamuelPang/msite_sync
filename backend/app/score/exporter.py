 
from music21 import stream
from pydub import AudioSegment
import os
import tempfile

class ScoreExporter:
    @staticmethod
    def export_to_audio(score: stream.Score, format: str = "mp3"):
        with tempfile.NamedTemporaryFile(suffix=".mid", delete=False) as midi_file:
            score.write("midi", midi_file.name)
            midi_file.close()
            audio = AudioSegment.from_file(midi_file.name, format="midi")
            output_path = f"output.{format}"
            audio.export(output_path, format=format)
            os.unlink(midi_file.name)
        return output_path