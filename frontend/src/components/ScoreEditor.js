import React, { useState, useEffect, useRef } from 'react';
import NoteInput from './NoteInput';
import ScoreCanvas from './ScoreCanvas';
import AudioControls from './AudioControls';
import ScoreControls from './ScoreControls';
import NoteButtons from './NoteButtons';

const MAX_MEASURES = 100;
const TEMPO_MIN = 20;
const TEMPO_MAX = 300;

const ScoreEditor = () => {
  const scoreRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  const [measures, setMeasures] = useState([]);
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
  const [timeSignature, setTimeSignature] = useState('4/4');
  const [currentNoteIndex, setCurrentNoteIndex] = useState(-1);

  useEffect(() => {
    return () => {
      if (recordedAudio) {
        URL.revokeObjectURL(recordedAudio);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [recordedAudio]);

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
        <label>Time Signature: </label>
        <select
          value={timeSignature}
          onChange={(e) => setTimeSignature(e.target.value)}
          style={{ marginLeft: '5px' }}
        >
          <option value="2/4">2/4</option>
          <option value="3/4">3/4</option>
          <option value="4/4">4/4</option>
        </select>
      </div>
      <NoteInput
        isJianpuMode={isJianpuMode}
        setIsJianpuMode={setIsJianpuMode}
        jianpuInput={jianpuInput}
        setJianpuInput={setJianpuInput}
        selectedDuration={selectedDuration}
        setSelectedDuration={setSelectedDuration}
        setMeasures={setMeasures}
        timeSignature={timeSignature}
      />
      <div style={{ marginBottom: '10px' }}>
        <label>Tempo (BPM): </label>
        <input
          type="number"
          value={tempo}
          onChange={(e) => {
            const value = parseInt(e.target.value) || 120;
            setTempo(Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, value)));
          }}
          min={TEMPO_MIN}
          max={TEMPO_MAX}
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
      <AudioControls
        isRecording={isRecording}
        setIsRecording={setIsRecording}
        recordedAudio={recordedAudio}
        setRecordedAudio={setRecordedAudio}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        mediaRecorderRef={mediaRecorderRef}
        audioChunksRef={audioChunksRef}
        audioRef={audioRef}
      />
      <ScoreCanvas
        scoreRef={scoreRef}
        measures={measures}
        setMeasures={setMeasures}
        isJianpuMode={isJianpuMode}
        jianpuInput={jianpuInput}
        selectedDuration={selectedDuration}
        timeSignature={timeSignature}
        currentNoteIndex={currentNoteIndex}
      />
      <NoteButtons
        measures={measures}
        setMeasures={setMeasures}
        isJianpuMode={isJianpuMode}
      />
      <ScoreControls
        measures={measures}
        title={title}
        scoreId={scoreId}
        setScoreId={setScoreId}
        selectedInstrument={selectedInstrument}
        tempo={tempo}
        scoreRef={scoreRef}
        setCurrentNoteIndex={setCurrentNoteIndex}
      />
    </div>
  );
};

export default ScoreEditor;