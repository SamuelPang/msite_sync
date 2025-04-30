import React, { useState, useEffect, useRef } from 'react';
import { Renderer, Stave, StaveNote, Formatter } from 'vexflow';
import axios from 'axios';
import * as Tone from 'tone';

const ScoreEditor = () => {
  const scoreRef = useRef(null);
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('New Score');
  const [selectedDuration, setSelectedDuration] = useState('q'); // Default to quarter note

  useEffect(() => {
    renderScore();
  }, [notes]);

  const renderScore = () => {
    const div = scoreRef.current;
    // Clear previous content
    while (div.firstChild) {
      div.removeChild(div.firstChild);
    }

    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(500, 200);
    const context = renderer.getContext();

    const stave = new Stave(10, 40, 400);
    stave.addClef('treble').addTimeSignature('4/4');
    stave.setContext(context).draw();

    if (notes.length > 0) {
      const vexNotes = notes.map(note =>
        new StaveNote({
          keys: [note.pitch],
          duration: note.duration,
        })
      );
      Formatter.FormatAndDraw(context, stave, vexNotes);
    }
  };

  const handleCanvasClick = (event) => {
    const rect = scoreRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Staff properties (VexFlow defaults)
    const staveTop = 80; // Top of the staff (y-position)
    const lineSpacing = 10; // Distance between staff lines in pixels
    const staffHeight = 4 * lineSpacing; // 5 lines, 4 spaces

    // Define staff boundaries
    const staffBottom = staveTop + staffHeight;
    if (y < staveTop - lineSpacing || y > staffBottom + lineSpacing) {
      return; // Ignore clicks too far above or below the staff
    }

    // Reference: Middle line of treble staff is B4
    const middleLineY = staveTop + 2 * lineSpacing; // Y-position of B4 (third line)
    const referencePitch = { note: 'b', octave: 4 };

    // Calculate half-steps from B4
    const yOffset = middleLineY - y; // Positive = higher pitch, negative = lower
    const halfSteps = Math.round(yOffset / (lineSpacing / 2)); // Each line/space = 1 half-step

    // Calculate new pitch
    const pitchNames = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
    let noteIndex = pitchNames.indexOf(referencePitch.note);
    let newOctave = referencePitch.octave;
    noteIndex += halfSteps;

    // Adjust octave and note index
    while (noteIndex >= pitchNames.length) {
      noteIndex -= pitchNames.length;
      newOctave += 1;
    }
    while (noteIndex < 0) {
      noteIndex += pitchNames.length;
      newOctave -= 1;
    }

    // Ensure pitch is within range (C3 to C6)
    if (newOctave < 3 || (newOctave === 6 && pitchNames[noteIndex] > 'c')) {
      return; // Ignore out-of-range pitches
    }

    const newPitch = `${pitchNames[noteIndex]}/${newOctave}`;

    // Add new note with selected duration
    setNotes([...notes, { pitch: newPitch, duration: selectedDuration }]);
  };

  const handleCanvasContextMenu = (event) => {
    event.preventDefault();
    const rect = scoreRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;

    // Find note to delete based on x-position (approximate)
    const noteWidth = 400 / (notes.length + 1);
    const noteIndex = Math.floor(x / noteWidth);
    if (noteIndex >= 0 && noteIndex < notes.length) {
      setNotes(notes.filter((_, i) => i !== noteIndex));
    }
  };

  const handleNoteClick = (index) => {
    // Cycle through durations (whole, half, quarter)
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

      notes.forEach((note) => {
        // Convert VexFlow pitch (e.g., 'c/4') to Tone.js pitch (e.g., 'C4')
        const tonePitch = note.pitch.split('/')[0].toUpperCase() + note.pitch.split('/')[1];
        // Map VexFlow duration to Tone.js duration (assuming 120 BPM, 4/4 time)
        const durationMap = {
          'w': '2n', // Whole note = 2 seconds (4 beats)
          'h': '4n', // Half note = 1 second (2 beats)
          'q': '8n'  // Quarter note = 0.5 seconds (1 beat)
        };
        const toneDuration = durationMap[note.duration] || '8n';
        synth.triggerAttackRelease(tonePitch, toneDuration, currentTime);
        // Increment time based on duration (in seconds, 120 BPM)
        const durationSeconds = {
          'w': 2,
          'h': 1,
          'q': 0.5
        };
        currentTime += durationSeconds[note.duration] || 0.5;
      });
    } catch (error) {
      console.error('Error playing score:', error);
      alert('Failed to play score.');
    }
  };

  const saveScore = async () => {
    try {
      const scoreData = { title, tracks: [{ notes }] };
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/scores/`, scoreData);
      alert('Score saved!');
    } catch (error) {
      console.error('Error saving score:', error);
      alert('Failed to save score.');
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
    </div>
  );
};

export default ScoreEditor;