import React, { useState, useEffect, useRef } from 'react';
import { Renderer, Stave, StaveNote, Formatter } from 'vexflow';
import axios from 'axios';
import * as Tone from 'tone';
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
  const [tempo, setTempo] = useState(120); // Default tempo: 120 BPM

  useEffect(() => {
    renderScore();
  }, [notes, isJianpuMode]);

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

    // Clear previous content
    while (targetDiv.firstChild) {
      targetDiv.removeChild(targetDiv.firstChild);
    }

    const renderer = new Renderer(targetDiv, Renderer.Backends.SVG);
    renderer.resize(500, 200);
    const context = renderer.getContext();

    const stave = new Stave(10, 40, 400);
    stave.addClef('treble').addTimeSignature('4/4');
    stave.setContext(context).draw();

    if (notes.length > 0) {
      const vexNotes = notes.map(note =>
        new StaveNote({
          keys: [note.pitch === 'r' ? 'b/4' : note.pitch],
          duration: note.duration + (note.pitch === 'r' ? 'r' : ''),
        })
      );
      Formatter.FormatAndDraw(context, stave, vexNotes);
    }

    if (isJianpuMode && jianpuInput) {
      context.setFont('Arial', 12).fillText(jianpuInput, 10, 180);
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
      await Tone.start();
      const synth = new Tone.Synth().toDestination();
      const now = Tone.now();
      let currentTime = now;

      // Calculate duration in seconds based on tempo (BPM)
      // Quarter note duration = (60 / BPM) seconds
      const quarterNoteDuration = 60 / tempo; // Seconds per quarter note
      const durationMap = { 'w': 4, 'h': 2, 'q': 1 }; // Quarter lengths

      notes.forEach((note) => {
        if (note.pitch === 'r') {
          // Skip playback for rests, but advance time
          const noteQuarterLength = durationMap[note.duration] || 1;
          currentTime += noteQuarterLength * quarterNoteDuration;
          return;
        }
        const tonePitch = note.pitch.split('/')[0].toUpperCase() + note.pitch.split('/')[1];
        const noteQuarterLength = durationMap[note.duration] || 1;
        const toneDuration = noteQuarterLength * quarterNoteDuration; // Duration in seconds
        synth.triggerAttackRelease(tonePitch, toneDuration, currentTime);
        currentTime += toneDuration;
      });
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