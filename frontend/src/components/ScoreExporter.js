 
import React from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';

const ScoreExporter = () => {
  const { scoreId } = useParams();

  const exportScore = async (format) => {
    try {
      const response = await axios.post(
        `http://localhost:8000/api/scores/${scoreId}/export`,
        { track_id: 0, start: 0, end: 4, format }
      );
      const link = document.createElement('a');
      link.href = `http://localhost:8000/${response.data.file_path}`;
      link.download = `score.${format}`;
      link.click();
    } catch (error) {
      console.error('Error exporting score:', error);
    }
  };

  return (
    <div>
      <h2>Score Exporter</h2>
      <button onClick={() => exportScore('mp3')}>Export MP3</button>
      <button onClick={() => exportScore('wav')}>Export WAV</button>
    </div>
  );
};

export default ScoreExporter;