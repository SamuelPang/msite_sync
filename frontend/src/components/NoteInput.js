import React, { useCallback } from 'react';

const NoteInput = ({ isJianpuMode, setIsJianpuMode, jianpuInput, setJianpuInput, selectedDuration, setSelectedDuration, setMeasures }) => {
  const parseJianpu = useCallback((jianpuStr) => {
    if (!jianpuStr.trim()) return [];

    const jianpuMap = { '1': 'c', '2': 'd', '3': 'e', '4': 'f', '5': 'g', '6': 'a', '7': 'b', '0': null };
    const durationMap = { '': 'q', '-': 'h', '--': 'w' };
    const notesArray = jianpuStr.trim().split(/\s+/).slice(0, 1000);
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
        convertedNotes.push({ pitch: 'r', duration });
      } else if (jianpuMap[pitch]) {
        convertedNotes.push({ pitch: `${jianpuMap[pitch]}/${octave}`, duration });
      } else {
        console.warn(`Invalid Jianpu note: ${noteStr}`);
      }
    });

    const durationMapForGrouping = { 'w': 4, 'h': 2, 'q': 1 };
    const beatsPerMeasure = 4;
    const newMeasures = [];
    let currentMeasure = { notes: [], duration: 0 };

    convertedNotes.forEach(note => {
      const noteDuration = durationMapForGrouping[note.duration] || 1;
      if (currentMeasure.duration + noteDuration <= beatsPerMeasure) {
        currentMeasure.notes.push(note);
        currentMeasure.duration += noteDuration;
      } else {
        const remainingDuration = beatsPerMeasure - currentMeasure.duration;
        if (remainingDuration > 0) {
          currentMeasure.notes.push({ ...note, duration: getDurationForQuarterNotes(remainingDuration) });
          currentMeasure.duration = beatsPerMeasure;
        }
        if (newMeasures.length < 100) {
          newMeasures.push(currentMeasure);
        }
        currentMeasure = { notes: [], duration: 0 };
        const leftoverDuration = noteDuration - remainingDuration;
        if (leftoverDuration > 0) {
          currentMeasure.notes.push({ ...note, duration: getDurationForQuarterNotes(leftoverDuration) });
          currentMeasure.duration = leftoverDuration;
        }
      }
    });

    if (currentMeasure.notes.length > 0 && newMeasures.length < 100) {
      newMeasures.push(currentMeasure);
    }

    return newMeasures;
  }, []);

  const getDurationForQuarterNotes = (quarterNotes) => {
    const map = { 4: 'w', 2: 'h', 1: 'q' };
    return map[quarterNotes] || 'q';
  };

  const handleJianpuChange = useCallback((e) => {
    const input = e.target.value.slice(0, 10000);
    setJianpuInput(input);
    const parsedMeasures = parseJianpu(input);
    setMeasures(parsedMeasures);
  }, [parseJianpu, setJianpuInput, setMeasures]);

  return (
    <div style={{ marginBottom: '10px' }}>
      <label>
        <input
          type="checkbox"
          checked={isJianpuMode}
          onChange={(e) => setIsJianpuMode(e.target.checked)}
        /> Use Jianpu Mode
      </label>
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
 sella            onClick={() => setSelectedDuration('q')}
            style={{ margin: '5px', background: selectedDuration === 'q' ? '#ccc' : '#fff' }}
          >
            Quarter
          </button>
        </div>
      )}
    </div>
  );
};

export default NoteInput;