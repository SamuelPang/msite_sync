import React, { useCallback } from 'react';

const NoteButtons = ({ measures, setMeasures, isJianpuMode }) => {
  const handleNoteClick = useCallback((index) => {
    if (isJianpuMode) return;
    const durationMap = ['w', 'h', 'q'];
    let measureIndex = 0;
    let noteIndex = index;
    let currentNoteCount = 0;

    for (let i = 0; i < measures.length; i++) {
      if (noteIndex < currentNoteCount + measures[i].notes.length) {
        measureIndex = i;
        noteIndex -= currentNoteCount;
        break;
      }
      currentNoteCount += measures[i].notes.length;
    }

    if (noteIndex < 0 || noteIndex >= measures[measureIndex].notes.length) return;

    const currentDuration = measures[measureIndex].notes[noteIndex].duration;
    const currentIndex = durationMap.indexOf(currentDuration);
    const nextDuration = durationMap[(currentIndex + 1) % durationMap.length];

    setMeasures(prevMeasures => {
      const newMeasures = [...prevMeasures];
      const measure = { ...newMeasures[measureIndex] };
      measure.notes = [...measure.notes];
      measure.notes[noteIndex] = { ...measure.notes[noteIndex], duration: nextDuration };
      measure.duration = measure.notes.reduce((sum, note) => sum + ({ 'w': 4, 'h': 2, 'q': 1 }[note.duration] || 1), 0);
      newMeasures[measureIndex] = measure;
      return newMeasures;
    });
  }, [isJianpuMode, measures, setMeasures]);

  const noteButtons = measures.flatMap((measure, mIndex) =>
    measure.notes.map((note, nIndex) => (
      <button
        key={`${mIndex}-${nIndex}`}
        onClick={() => handleNoteClick(measures.slice(0, mIndex).reduce((sum, m) => sum + m.notes.length, 0) + nIndex)}
        style={{ margin: '5px' }}
      >
        {note.pitch} ({note.duration})
      </button>
    ))
  );

  return <div>{noteButtons}</div>;
};

export default NoteButtons;