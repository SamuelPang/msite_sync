from music21 import stream, note
s = stream.Stream()
s.append(note.Note('C4', quarterLength=1))
s.write('midi', 'test.mid')

# ffmpeg -i test.mid test.mp3

# check pydub to ffmpeg path
from pydub.utils import which
print(f"FFmpeg path: {which('ffmpeg')}")