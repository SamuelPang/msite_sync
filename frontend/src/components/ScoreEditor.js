import React, { useState, useEffect, useRef } from 'react';
import { Renderer, Stave, StaveNote, Formatter } from 'vexflow';
import axios from 'axios';

const ScoreEditor = () => {
  const scoreRef = useRef(null);
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('New Score');

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
          duration: 'q',
        })
      );
      Formatter.FormatAndDraw(context, stave, vexNotes);
    }
  };

  const handleCanvasClick = (event) => {
    const rect = scoreRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Simple y-to-pitch mapping (adjust as needed)
    const pitchMap = ['c/5', 'b/4', 'a/4', 'g/4', 'f/4', 'e/4', 'd/4', 'c/4'];
    const staveHeight = 100; // Approximate stave height
    const pitchIndex = Math.floor((y - 40) / (staveHeight / pitchMap.length));
    const pitch = pitchMap[pitchIndex] || 'c/4';

    // Add new note
    setNotes([...notes, { pitch, duration: 'q' }]);
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
    // Cycle pitch for clicked note
    const pitchMap = ['c/4', 'd/4', 'e/4', 'f/4', 'g/4', 'a/4', 'b/4', 'c/5'];
    const currentPitch = notes[index].pitch;
    const currentIndex = pitchMap.indexOf(currentPitch);
    const nextPitch = pitchMap[(currentIndex + 1) % pitchMap.length];

    const newNotes = [...notes];
    newNotes[index] = { ...newNotes[index], pitch: nextPitch };
    setNotes(newNotes);
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
            {note.pitch}
          </button>
        ))}
      </div>
      <button onClick={saveScore} style={{ marginTop: '10px' }}>
        Save Score
      </button>
    </div>
  );
};

export default ScoreEditor;