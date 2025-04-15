import React, { useEffect, useRef } from 'react';
import { Flow } from 'vexflow';
import axios from 'axios';

const ScoreEditor = () => {
  const scoreRef = useRef(null);

  useEffect(() => {
    const { Renderer, Stave } = Flow;
    const div = scoreRef.current;
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(500, 200);
    const context = renderer.getContext();
    const stave = new Stave(10, 40, 400);
    stave.addClef('treble').addTimeSignature('4/4');
    stave.setContext(context).draw();
  }, []);

  const saveScore = async () => {
    try {
      const scoreData = { title: 'New Score', tracks: [] };
      await axios.post('http://localhost:8001/api/scores/', scoreData);
      alert('Score saved!');
    } catch (error) {
      console.error('Error saving score:', error);
    }
  };

  return (
    <div>
      <h2>Score Editor</h2>
      <div ref={scoreRef} id="score"></div>
      <button onClick={saveScore}>Save Score</button>
    </div>
  );
};

export default ScoreEditor;