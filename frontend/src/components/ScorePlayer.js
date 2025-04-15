import React from 'react';
import * as Tone from 'tone';
import axios from 'axios';
import { useParams } from 'react-router-dom';

const ScorePlayer = () => {
  const { scoreId } = useParams();

  const playSegment = async () => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/scores/${scoreId}/play`,
        { track_id: 0, start: 0, end: 4 }
      );
      await Tone.start();
      const synth = new Tone.Synth().toDestination();
      const now = Tone.now();
      response.data.segment.forEach((note, index) => {
        synth.triggerAttackRelease(note, '8n', now + index * 0.5);
      });
    } catch (error) {
      console.error('Error playing score:', error);
    }
  };

  return (
    <div>
      <h2>Score Player</h2>
      <button onClick={playSegment}>Play Segment</button>
    </div>
  );
};

export default ScorePlayer;