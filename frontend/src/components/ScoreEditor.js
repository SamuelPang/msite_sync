import React, { useState, useEffect, useRef } from 'react';
import { Renderer, Stave, StaveNote, Formatter, Voice } from 'vexflow';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';

const ScoreEditor = () => {
  const scoreRef = useRef(null);
  const [notes, setNotes] = useState([]);
  const [jianpuInput, setJianpuInput] = useState('');
  const [title, setTitle] = useState('New Score');
  const [selectedDuration, setSelectedDuration] = useState('q');
  const [scoreId, setScoreId] = useState(null);
  const [selectedInstrument, setSelectedInstrument] = useState('piano');
  const [isJianpuMode, setIsJianpuMode] = useState(false);
  const [tempo, setTempo] = useState(120);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);

  useEffect(() => {
    renderScore();
  }, [notes, isJianpuMode]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudio(audioUrl);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please ensure microphone access is granted.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(error => {
        console.error('Error playing audio:', error);
        alert('Failed to play recorded audio.');
      });
      setIsPlaying(true);
    }
  };

  const parseJianpu = (jianpuStr) => {
    const jianpuMap = { '1': 'c', '2': 'd', '3': 'e', '4': 'f', '5': 'g', '6': 'a', '7': 'b', '0': null };
    const durationMap = { '': 'q', '-': 'h', '--': 'w' };
    const notesArray = jianpuStr.trim().split(/\s+/);
    const convertedNotes = [];

    notesArray.forEach(noteStr => {
      if (!noteStr) return;

      let pitch = noteStr.replace(/[._-]+/g, '');
      let octave = 4;
      let duration = 'q';

      if (noteStr.includes('.')) octave = 5;
      if (noteStr.includes('_')) octave = 3;

      const durationMatch = noteStr.match(/[-]+/)?.[0] || '';
      duration = durationMap[durationMatch] || 'q';

      if (pitch === '0') {
        convertedNotes.push({
          pitch: 'r',
          duration: duration,
        });
      } else if (jianpuMap[pitch]) {
        convertedNotes.push({
          pitch: `${jianpuMap[pitch]}/${octave}`,
          duration: duration,
        });
      } else {
        console.warn(`Invalid Jianpu note: ${noteStr}`);
      }
    });

    return convertedNotes;
  };

  const handleJianpuChange = (e) => {
    setJianpuInput(e.target.value);
    const parsedNotes = parseJianpu(e.target.value);
    setNotes(parsedNotes);
    console.log('Parsed notes:', parsedNotes);
  };

  const renderScore = (targetDiv = scoreRef.current) => {
    if (!targetDiv) return;

    while (targetDiv.firstChild) {
      targetDiv.removeChild(targetDiv.firstChild);
    }

    const pixelsPerQuarterNote = 20; // Pixels per quarter note for spacing
    const noteSpacing = 10; // Additional spacing between notes, in pixels
    const durationMap = { 'w': 4, 'h': 2, 'q': 1 };
    const ticksPerQuarterNote = 960;
    const margin = 10; // Left and right margin
    const minStaveWidth = 200; // Minimum stave width for short scores
    const clefAndTimeWidth = 80; // Approximate width for clef and time signature
    const beatsPerMeasure = 4; // 4/4 time signature (4 quarter notes per measure)

    // Calculate total quarter notes
    const totalQuarterNotes = notes.reduce((sum, note) => {
      return sum + (durationMap[note.duration] || 1);
    }, 0);

    // Calculate stave width: account for clef/time, notes, and spacing
    const staveWidth = Math.max(
      minStaveWidth,
      clefAndTimeWidth + totalQuarterNotes * pixelsPerQuarterNote + notes.length * noteSpacing + 2 * margin
    );

    // Initialize renderer
    const renderer = new Renderer(targetDiv, Renderer.Backends.SVG);
    renderer.resize(staveWidth + 20, 200); // Add padding
    const context = renderer.getContext();

    // Create stave
    const stave = new Stave(margin, 40, staveWidth);
    stave.addClef('treble').addTimeSignature('4/4');
    stave.setContext(context).draw();

    if (notes.length > 0) {
      // Create VexFlow notes
      const vexNotes = notes.map(note =>
        new StaveNote({
          keys: [note.pitch === 'r' ? 'b/4' : note.pitch],
          duration: note.duration + (note.pitch === 'r' ? 'r' : ''),
        })
      );

      // Create a Voice to manage notes
      const voice = new Voice({
        num_beats: totalQuarterNotes,
        beat_value: 4,
      });
      voice.addTickables(vexNotes);

      // Format notes to fit within stave, accounting for clef/time signature
      new Formatter().joinVoices([voice]).format([voice], staveWidth - clefAndTimeWidth - 2 * margin);

      // Track cumulative duration and position for barlines
      let cumulativeQuarterNotes = 0;
      let currentX = 0;

      vexNotes.forEach((note, index) => {
        const duration = durationMap[note.duration] || 1;
        note.setIntrinsicTicks(duration * ticksPerQuarterNote);

        cumulativeQuarterNotes += duration;
        currentX += duration * pixelsPerQuarterNote + noteSpacing;

        // Draw barline at measure boundaries (every 4 quarter notes), except for the last note
        if (index < notes.length - 1 && cumulativeQuarterNotes % beatsPerMeasure === 0) {
          const barlineX = margin + clefAndTimeWidth + currentX - noteSpacing / 2;
          context.beginPath();
          context.moveTo(barlineX, 40); // Top of staff
          context.lineTo(barlineX, 120); // Bottom of staff
          context.stroke();
        }
      });

      // Draw the notes
      voice.draw(context, stave);
    }

    if (isJianpuMode && jianpuInput) {
      context.setFont('Arial', 12).fillText(jianpuInput, margin, 180);
    }
  };

  const handleCanvasClick = (event) => {
    if (isJianpuMode) return;
    const rect = scoreRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const staveTop = 80;
    const lineSpacing = 10;
    const staffHeight = 4 * lineSpacing;
    const staffBottom = staveTop + staffHeight;
    if (y < staveTop - lineSpacing || y > staffBottom + lineSpacing) {
      return;
    }

    const middleLineY = staveTop + 2 * lineSpacing;
    const referencePitch = { note: 'b', octave: 4 };
    const yOffset = middleLineY - y;
    const halfSteps = Math.round(yOffset / (lineSpacing / 2));

    const pitchNames = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
    let noteIndex = pitchNames.indexOf(referencePitch.note);
    let newOctave = referencePitch.octave;
    noteIndex += halfSteps;

    while (noteIndex >= pitchNames.length) {
      noteIndex -= pitchNames.length;
      newOctave += 1;
    }
    while (noteIndex < 0) {
      noteIndex += pitchNames.length;
      newOctave -= 1;
    }

    if (newOctave < 3 || (newOctave === 6 && pitchNames[noteIndex] > 'c')) {
      return;
    }

    const newPitch = `${pitchNames[noteIndex]}/${newOctave}`;
    setNotes([...notes, { pitch: newPitch, duration: selectedDuration }]);
  };

  const handleCanvasContextMenu = (event) => {
    event.preventDefault();
    if (isJianpuMode) return;
    const rect = scoreRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const noteWidth = 400 / (notes.length + 1);
    const noteIndex = Math.floor(x / noteWidth);
    if (noteIndex >= 0 && noteIndex < notes.length) {
      setNotes(notes.filter((_, i) => i !== noteIndex));
    }
  };

  const handleNoteClick = (index) => {
    if (isJianpuMode) return;
    const durationMap = ['w', 'h', 'q'];
    const currentDuration = notes[index].duration;
    const currentIndex = durationMap.indexOf(currentDuration);
    const nextDuration = durationMap[(currentIndex + 1) % durationMap.length];

    const newNotes = [...notes];
    newNotes[index] = { ...newNotes[index], duration: nextDuration };
    setNotes(newNotes);
  };

  const playScore = async () => {
    try {
      const scoreData = { title, tracks: [{ notes }] };
      const saveResponse = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/scores/`, scoreData);
      const currentScoreId = saveResponse.data.id;
      setScoreId(currentScoreId);

      const exportResponse = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/scores/${currentScoreId}/export`,
        { track_id: 0, start: 0, end: notes.length, format: 'mp3', instrument: selectedInstrument, tempo }
      );

      const fileUrl = `${process.env.REACT_APP_BACKEND_URL}/${exportResponse.data.file_path}`;
      const audio = new Audio(fileUrl);
      await audio.play();
    } catch (error) {
      console.error('Error playing score:', error);
      alert('Failed to play score.');
    }
  };

  const saveScore = async () => {
    try {
      const scoreData = { title, tracks: [{ notes }] };
      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/scores/`, scoreData);
      setScoreId(response.data.id);
      alert('Score saved!');
      return response.data.id;
    } catch (error) {
      console.error('Error saving score:', error);
      alert('Failed to save score.');
      throw error;
    }
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const exportScore = async (format) => {
    try {
      if (format === 'pdf') {
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        document.body.appendChild(tempDiv);

        renderScore(tempDiv);
        await delay(100);

        const svgElement = tempDiv.querySelector('svg');
        if (!svgElement) {
          throw new Error('Score SVG not found. Please ensure the score is rendered.');
        }

        svgElement.setAttribute('width', '500px');
        svgElement.setAttribute('height', '200px');
        svgElement.setAttribute('viewBox', '0 0 500 200');

        const svgData = svgElement.outerHTML;
        console.log('SVG Content for PDF Export:', svgData);

        const doc = new jsPDF();
        const svgWidthPx = 500;
        const svgHeightPx = 200;
        const svgAspectRatio = svgWidthPx / svgHeightPx;
        const pdfWidth = 190;
        const pdfHeight = pdfWidth / svgAspectRatio;

        await doc.svg(svgElement, {
          x: 10,
          y: 10,
          width: pdfWidth,
          height: pdfHeight,
        });

        const pdfBlob = doc.output('blob');
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${title || 'score'}.pdf`;
        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        document.body.removeChild(tempDiv);
        window.URL.revokeObjectURL(url);

        alert('PDF exported successfully!');
      } else {
        let currentScoreId = scoreId;
        if (!currentScoreId) {
          currentScoreId = await saveScore();
        }

        console.log('Export payload:', { track_id: 0, start: 0, end: notes.length, format, instrument: selectedInstrument, tempo });

        const response = await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/api/scores/${currentScoreId}/export`,
          { track_id: 0, start: 0, end: notes.length, format, instrument: selectedInstrument, tempo }
        );

        const fileUrl = `${process.env.REACT_APP_BACKEND_URL}/${response.data.file_path}`;
        const fileResponse = await fetch(fileUrl);
        if (!fileResponse.ok) {
          throw new Error(`Failed to fetch file: ${fileResponse.statusText}`);
        }
        const blob = await fileResponse.blob();

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${title || 'score'}.${format === 'musicxml' ? 'xml' : format}`;
        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        alert(`${format.toUpperCase()} exported successfully!`);
      }
    } catch (error) {
      console.error(`Error exporting ${format}:`, error);
      alert(`Failed to export ${format}: ${error.message}`);
    }
  };

  return (
    <div>
      <h2>Score Editor</h2>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Score Title"
        style={{ marginBottom: '10px' }}
      />
      <div style={{ marginBottom: '10px' }}>
        <label>
          <input
            type="checkbox"
            checked={isJianpuMode}
            onChange={(e) => setIsJianpuMode(e.target.checked)}
          /> Use Jianpu Mode
        </label>
      </div>
      {isJianpuMode ? (
        <textarea
          value={jianpuInput}
          onChange={handleJianpuChange}
          placeholder="Enter Jianpu (e.g., 1 2 3. 5-)"
          rows="3"
          cols="50"
          style={{ marginBottom: '10px' }}
        />
      ) : (
        <div style={{ marginBottom: '10px' }}>
          <label>Select Note Duration: </label>
          <button
            onClick={() => setSelectedDuration('w')}
            style={{ margin: '5px', background: selectedDuration === 'w' ? '#ccc' : '#fff' }}
          >
            Whole
          </button>
          <button
            onClick={() => setSelectedDuration('h')}
            style={{ margin: '5px', background: selectedDuration === 'h' ? '#ccc' : '#fff' }}
          >
            Half
          </button>
          <button
            onClick={() => setSelectedDuration('q')}
            style={{ margin: '5px', background: selectedDuration === 'q' ? '#ccc' : '#fff' }}
          >
            Quarter
          </button>
        </div>
      )}
      <div style={{ marginBottom: '10px' }}>
        <label>Tempo (BPM): </label>
        <input
          type="number"
          value={tempo}
          onChange={(e) => setTempo(Math.max(1, parseInt(e.target.value) || 120))}
          min="1"
          style={{ width: '60px', marginLeft: '5px' }}
        />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label>Select Instrument: </label>
        <select
          value={selectedInstrument}
          onChange={(e) => setSelectedInstrument(e.target.value)}
        >
          <option value="piano">Piano</option>
          <option value="violin">Violin</option>
          <option value="flute">Flute</option>
          <option value="guitar">Guitar</option>
        </select>
      </div>
      <div style={{ marginBottom: '10px' }}>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          style={{ margin: '5px', background: isRecording ? '#f88' : '#fff' }}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
        {recordedAudio && (
          <div style={{ marginTop: '10px' }}>
            <audio
              ref={audioRef}
              src={recordedAudio}
              onEnded={() => setIsPlaying(false)}
            />
            <button
              onClick={togglePlayPause}
              style={{ margin: '5px' }}
            >
              {isPlaying ? 'Pause' : 'Play'} Recorded Audio
            </button>
          </div>
        )}
      </div>
      <div
        ref={scoreRef}
        onClick={handleCanvasClick}
        onContextMenu={handleCanvasContextMenu}
        style={{ cursor: 'pointer' }}
      ></div>
      <div>
        {notes.map((note, index) => (
          <button
            key={index}
            onClick={() => handleNoteClick(index)}
            style={{ margin: '5px' }}
          >
            {note.pitch} ({note.duration})
          </button>
        ))}
      </div>
      <button onClick={saveScore} style={{ margin: '10px' }}>
        Save Score
      </button>
      <button onClick={playScore} style={{ margin: '10px' }}>
        Play Score
      </button>
      <button onClick={() => exportScore('musicxml')} style={{ margin: '10px' }}>
        Export MusicXML
      </button>
      <button onClick={() => exportScore('pdf')} style={{ margin: '10px' }}>
        Export PDF
      </button>
      <button onClick={() => exportScore('mp3')} style={{ margin: '10px' }}>
        Export MP3
      </button>
    </div>
  );
};

export default ScoreEditor;