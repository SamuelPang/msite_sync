from music21 import stream, instrument
import os, time
import os.path
import tempfile
import subprocess
from app.dependencies import EXPORT_DIR
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ScoreExporter:
    @staticmethod
    def export_to_audio(score: stream.Score, format: str = "mp3", instrument_name: str = "piano") -> str:
        """
        Export a music21 score to an audio file (e.g., MP3).
        Returns the path to the exported file.
        """
        instrument_map = {
            "piano": instrument.Piano,
            "violin": instrument.Violin,
            "flute": instrument.Flute,
            "guitar": instrument.Guitar
        }
        selected_instrument = instrument_map.get(instrument_name, instrument.Piano)()
        for part in score.parts:
            part.insert(0, selected_instrument)

        logger.info(f"Number of notes and rests in score: {len(list(score.flat.notesAndRests))}")
        tempo_markings = score.getElementsByClass('MetronomeMark')
        if tempo_markings:
            logger.info(f"Tempo in score: {tempo_markings[0].number} BPM")

        with tempfile.NamedTemporaryFile(suffix=".mid", delete=False) as midi_file:
            score.write("midi", midi_file.name)
            midi_file.close()
            wav_file = midi_file.name.replace(".mid", ".wav")
            try:
                midi_file_full_path = os.path.realpath(midi_file.name)
                print(f"Processing MIDI file (full path): {midi_file_full_path}")
                # TODO: Check if FluidSynth is installed and available in the PATH
                # Step 1: Use FluidSynth to convert MIDI to WAV with a soundfont C:\workspace\aud\soundfonts\GeneralUser GS 1.472
                soundfont_path = "D:/Program Files/SF2/GeneralUser GS 1.472/GeneralUser GS v1.472.sf2"  # Adjust this path
                if not os.path.exists(soundfont_path):
                    raise FileNotFoundError(f"Soundfont not found at: {soundfont_path}")

                fluidsynth_cmd = [
                    "fluidsynth",
                    "-ni",
                    "-g", "1.0",
                    "-F", wav_file,
                    soundfont_path,
                    midi_file_full_path
                ]
                result = subprocess.run(
                    fluidsynth_cmd,
                    check=True,
                    capture_output=True,
                    text=True
                )
                logger.info(f"FluidSynth output: {result.stdout}")
                if result.stderr:
                    logger.warning(f"FluidSynth error: {result.stderr}")

                output_filename = f"score_{int(time.time())}.{format}"
                output_path = os.path.join(EXPORT_DIR, output_filename)
                # TODO: Check if ffmpeg is installed and available in the PATH
                ffmpeg_cmd = [
                    "D:/Program Files/ffmpeg_full/bin/ffmpeg.exe",  # Adjust this path to your working ffmpeg
                    "-i", wav_file,
                    "-f", "mp3",
                    "-loglevel", "verbose",
                    output_path
                ]
                result = subprocess.run(
                    ffmpeg_cmd,
                    check=True,
                    capture_output=True,
                    text=True
                )
                logger.info(f"FFmpeg output: {result.stdout}")
                if result.stderr:
                    logger.warning(f"FFmpeg error: {result.stderr}")
            except subprocess.CalledProcessError as e:
                raise RuntimeError(f"Failed to convert MIDI to MP3: {e.stderr}")
            finally:
                os.unlink(midi_file.name)
                if os.path.exists(wav_file):
                    os.unlink(wav_file)
        return output_path

    @staticmethod
    def export_to_musicxml(score: stream.Score) -> str:
        """
        Export a music21 score to MusicXML.
        Returns the path to the exported file.
        """
        output_filename = f"score_{int(time.time())}.xml"
        output_path = os.path.join(EXPORT_DIR, output_filename)
        score.write("musicxml", output_path)
        logger.info(f"Exported to MusicXML at: {output_path}")
        return output_path
    #
    # # will be implemented in Frontend
    #
    # @staticmethod
    # def export_to_pdf(score: stream.Score) -> str:
    #     """
    #     Export a music21 score to PDF.
    #     Returns the path to the exported file.
    #     """
    #     output_filename = f"score_{int(time.time())}.pdf"
    #     output_path = os.path.join(EXPORT_DIR, output_filename)
    #     score.write("pdf", output_path)  # Requires MuseScore or similar
    #     return output_path