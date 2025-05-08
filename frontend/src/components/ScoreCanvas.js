import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Renderer, Stave, StaveNote, Formatter, Voice, Barline } from 'vexflow';
import * as Tone from 'tone';

const ScoreCanvas = ({ scoreRef, measures, setMeasures, isJianpuMode, jianpuInput, selectedDuration, timeSignature }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNote, setDraggedNote] = useState(null);
  const [dragStartY, setDragStartY] = useState(0);
  const measuresPerLine = 4;
  const synthRef = useRef(null);

  const getBeatsPerMeasure = useCallback(() => {
    switch (timeSignature) {
      case '2/4': return 2;
      case '3/4': return 3;
      case '4/4': return 4;
      default: return 4;
    }
  }, [timeSignature]);

  // Initialize synth on component mount
  useEffect(() => {
    synthRef.current = new Tone.Synth().toDestination();
    return () => {
      if (synthRef.current) {
        synthRef.current.dispose();
      }
    };
  }, []);

  // Function to convert pitch from note/octave to MIDI note name
  const convertToMidiNote = useCallback((pitch) => {
    if (pitch === 'r') return null;
    const [note, octave] = pitch.split('/');
    const midiNote = `${note.toUpperCase()}${octave}`;
    return midiNote;
  }, []);

  // Function to play a single note with fixed eighth note duration
  const playNote = useCallback(async (pitch) => {
    if (pitch === 'r' || !synthRef.current) return; // Skip rests or if synth not ready
    const midiNote = convertToMidiNote(pitch);
    if (!midiNote) return;

    try {
      await Tone.start();
      // Stop any currently playing note
      synthRef.current.triggerRelease();
      // Play the new note
      synthRef.current.triggerAttackRelease(midiNote, '8n');
    } catch (error) {
      console.error('Error playing note:', error);
    }
  }, [convertToMidiNote]);

  useEffect(() => {
    const beatsPerMeasure = getBeatsPerMeasure();
    const durationMap = { 'w': 4, 'h': 2, 'q': 1 };

    const reorganizeMeasures = () => {
      const allNotes = measures.flatMap(measure => measure.notes);
      const newMeasures = [];
      let currentMeasure = { notes: [], duration: 0 };

      allNotes.forEach(note => {
        const noteDuration = durationMap[note.duration] || 1;
        if (currentMeasure.duration + noteDuration <= beatsPerMeasure) {
          currentMeasure.notes.push(note);
          currentMeasure.duration += noteDuration;
        } else {
          const remainingDuration = beatsPerMeasure - currentMeasure.duration;
          if (remainingDuration > 0) {
            currentMeasure.notes.push({ ...note, duration: getDurationForQuarterNotes(remainingDuration) });
            currentMeasure.duration = beatsPerMeasure;
          }
          newMeasures.push(currentMeasure);
          currentMeasure = { notes: [], duration: 0 };
          const leftoverDuration = noteDuration - remainingDuration;
          if (leftoverDuration > 0) {
            currentMeasure.notes.push({ ...note, duration: getDurationForQuarterNotes(leftoverDuration) });
            currentMeasure.duration = leftoverDuration;
          }
        }
      });

      if (currentMeasure.notes.length > 0) {
        newMeasures.push(currentMeasure);
      }

      if (newMeasures.length % measuresPerLine === 0 && newMeasures[newMeasures.length - 1].duration >= beatsPerMeasure) {
        newMeasures.push({ notes: [], duration: 0 });
      }

      setMeasures(newMeasures);
    };

    if (measures.length > 0) {
      reorganizeMeasures();
    }
  }, [timeSignature, setMeasures]);

  const getDurationForQuarterNotes = (quarterNotes) => {
    const map = { 4: 'w', 2: 'h', 1: 'q' };
    return map[quarterNotes] || 'q';
  };

  const renderScore = useCallback((targetDiv = scoreRef.current) => {
    if (!targetDiv) {
      console.error('Target div for rendering score is not available.');
      return;
    }

    while (targetDiv.firstChild) {
      targetDiv.removeChild(targetDiv.firstChild);
    }

    const defaultStaveWidth = 300;
    const pixelsPerQuarterNote = 20;
    const noteSpacing = 10;
    const durationMap = { 'w': 4, 'h': 2, 'q': 1 };
    const margin = 10;
    const clefAndTimeWidth = 50;
    const beatsPerMeasure = getBeatsPerMeasure();
    const staveHeight = 100;

    let maxStaveWidth = defaultStaveWidth;
    measures.forEach(measure => {
      const measureQuarterNotes = measure.notes.reduce((sum, note) => sum + (durationMap[note.duration] || 1), 0);
      const measureNotes = measure.notes.length;
      const measureWidth = clefAndTimeWidth + measureQuarterNotes * pixelsPerQuarterNote + measureNotes * noteSpacing + 2 * margin;
      maxStaveWidth = Math.max(maxStaveWidth, measureWidth);
    });

    const staveWidth = maxStaveWidth;
    const numLines = Math.ceil(Math.max(measures.length, 1) / measuresPerLine);
    const svgWidth = staveWidth * Math.min(Math.max(measures.length, 1), measuresPerLine);
    const svgHeight = staveHeight * numLines + 20;

    const renderer = new Renderer(targetDiv, Renderer.Backends.SVG);
    renderer.resize(svgWidth + 20, svgHeight);
    const context = renderer.getContext();
    context.setFillStyle('#000000');
    context.setStrokeStyle('#000000');
    context.scale(1, 1);

    const voices = [];
    const staves = [];

    if (measures.length === 0) {
      const stave = new Stave(margin, 20, staveWidth);
      stave.addClef('treble').addTimeSignature(timeSignature);
      stave.setContext(context);
      stave.draw();
      staves.push(stave);
    } else {
      measures.forEach((measure, measureIndex) => {
        const measureQuarterNotes = measure.notes.reduce((sum, note) => sum + (durationMap[note.duration] || 1), 0);

        let vexNotes = measure.notes.map(note => {
          return new StaveNote({
            keys: [note.pitch === 'r' ? 'b/4' : note.pitch],
            duration: note.duration + (note.pitch === 'r' ? 'r' : ''),
          });
        });

        const remainingBeats = beatsPerMeasure - measureQuarterNotes;
        if (remainingBeats > 0) {
          for (let i = 0; i < remainingBeats; i++) {
            vexNotes.push(new StaveNote({
              keys: ['b/4'],
              duration: 'qr',
            }));
          }
        }

        const lineIndex = Math.floor(measureIndex / measuresPerLine);
        const staveIndexInLine = measureIndex % measuresPerLine;
        const x = margin + staveIndexInLine * staveWidth;
        const y = 20 + lineIndex * staveHeight;

        const stave = new Stave(x, y, staveWidth);
        if (measureIndex === 0 || (measureIndex % measuresPerLine === 0)) {
          stave.addClef('treble').addTimeSignature(timeSignature);
        }
        stave.setContext(context);
        staves.push(stave);

        const voice = new Voice({
          num_beats: beatsPerMeasure,
          beat_value: 4,
        });
        voice.addTickables(vexNotes);
        voices.push(voice);
      });
    }

    staves.forEach((stave, index) => {
      stave.draw();
      if (index < staves.length - 1 && measures.length > 0) {
        const barline = new Barline(Barline.type.SINGLE);
        barline.setContext(context).setStave(stave);
        barline.draw();
      }
    });

    if (voices.length > 0) {
      try {
        new Formatter().joinVoices(voices).format(voices, staveWidth - clefAndTimeWidth - 2 * margin);
        voices.forEach((voice, index) => {
          voice.draw(context, staves[index]);
        });
      } catch (error) {
        console.error('VexFlow rendering error:', error);
      }
    }

    if (isJianpuMode && jianpuInput) {
      context.setFont('Arial', 12).fillText(jianpuInput, margin, svgHeight - 10);
    }
  }, [measures, isJianpuMode, jianpuInput, scoreRef, timeSignature]);

  const getNoteAtPosition = useCallback((x, y) => {
    if (measures.length === 0) return null;

    const defaultStaveWidth = 300;
    const margin = 10;
    const clefAndTimeWidth = 50;
    const staveHeight = 100;
    const staveTopOffset = 20;
    const lineSpacing = 10;
    const staffHeight = 4 * lineSpacing;
    const tolerance = 15;

    let maxStaveWidth = defaultStaveWidth;
    const durationMap = { 'w': 4, 'h': 2, 'q': 1 };
    measures.forEach(measure => {
      const measureQuarterNotes = measure.notes.reduce((sum, note) => sum + (durationMap[note.duration] || 1), 0);
      const measureNotes = measure.notes.length;
      const measureWidth = clefAndTimeWidth + measureQuarterNotes * 20 + measureNotes * 10 + 2 * margin;
      maxStaveWidth = Math.max(maxStaveWidth, measureWidth);
    });

    const staveWidth = maxStaveWidth;

    const numLines = Math.ceil(Math.max(measures.length, 1) / measuresPerLine);
    let lineIndex = -1;
    for (let i = 0; i < numLines; i++) {
      const staveY = staveTopOffset + i * staveHeight;
      const staveTop = staveY - tolerance;
      const staveBottom = staveY + staffHeight + tolerance;
      if (y >= staveTop && y <= staveBottom) {
        lineIndex = i;
        break;
      }
    }

    if (lineIndex === -1) {
      return null;
    }

    const xInCanvas = x - margin;
    const staveIndexInLine = Math.floor(xInCanvas / staveWidth);
    const measureIndex = lineIndex * measuresPerLine + staveIndexInLine;

    if (measureIndex < 0 || measureIndex >= measures.length) {
      return null;
    }

    const measure = measures[measureIndex];
    if (!measure.notes.length) {
      return null;
    }

    const staveX = margin + (measureIndex % measuresPerLine) * staveWidth;
    const usableWidth = staveWidth - clefAndTimeWidth - 2 * margin;
    const noteWidth = usableWidth / (measure.notes.length || 1);
    const noteIndex = Math.floor((x - staveX - clefAndTimeWidth) / noteWidth);

    if (noteIndex >= 0 && noteIndex < measure.notes.length) {
      return { measureIndex, noteIndex };
    }

    return null;
  }, [measures]);

  const calculatePitch = useCallback((y, rect) => {
    const staveTop = 60;
    const lineSpacing = 10;
    const staffHeight = 4 * lineSpacing;
    const staffBottom = staveTop + staffHeight;
    const tolerance = 15;

    if (y < staveTop - tolerance || y > staffBottom + tolerance) {
      return null;
    }

    const middleLineY = staveTop + 2 * lineSpacing;
    const yOffset = middleLineY - y;
    const halfSteps = Math.round(yOffset / (lineSpacing / 2));

    const pitchNames = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
    const referencePitch = { note: 'b', octave: 4 };
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

    if (newOctave < 3 || newOctave > 5) {
      return null;
    }

    return `${pitchNames[noteIndex]}/${newOctave}`;
  }, []);

  const handleMouseDown = useCallback((event) => {
    if (isJianpuMode) {
      return;
    }

    const rect = scoreRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const note = getNoteAtPosition(x, y);
    if (note && measures[note.measureIndex].notes[note.noteIndex].pitch !== 'r') {
      setIsDragging(true);
      setDraggedNote(note);
      setDragStartY(y);
    }
  }, [isJianpuMode, measures, scoreRef, getNoteAtPosition]);

  const handleMouseMove = useCallback((event) => {
    if (!isDragging || !draggedNote) return;

    const rect = scoreRef.current.getBoundingClientRect();
    const y = event.clientY - rect.top;

    const newPitch = calculatePitch(y, rect);
    if (newPitch) {
      setMeasures(prevMeasures => {
        const newMeasures = [...prevMeasures];
        const measure = { ...newMeasures[draggedNote.measureIndex] };
        measure.notes = [...measure.notes];
        measure.notes[draggedNote.noteIndex] = {
          ...measure.notes[draggedNote.noteIndex],
          pitch: newPitch,
        };
        newMeasures[draggedNote.measureIndex] = measure;
        // Play the new pitch with fixed eighth note duration
        playNote(newPitch);
        return newMeasures;
      });
    }
  }, [isDragging, draggedNote, calculatePitch, setMeasures, playNote]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setDraggedNote(null);
      setDragStartY(0);
      // Ensure any playing note is stopped
      if (synthRef.current) {
        synthRef.current.triggerRelease();
      }
    }
  }, [isDragging]);

  const handleCanvasClick = useCallback((event) => {
    if (isJianpuMode) {
      return;
    }

    const rect = scoreRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const staveTop = 60;
    const lineSpacing = 10;
    const staffHeight = 4 * lineSpacing;
    const staffBottom = staveTop + staffHeight;
    const tolerance = 15;

    if (y < staveTop - tolerance || y > staffBottom + tolerance) {
      return;
    }

    const middleLineY = staveTop + 2 * lineSpacing;
    const yOffset = middleLineY - y;
    const halfSteps = Math.round(yOffset / (lineSpacing / 2));

    const pitchNames = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
    const referencePitch = { note: 'b', octave: 4 };
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

    if (newOctave < 3 || newOctave > 5) {
      return;
    }

    const newPitch = `${pitchNames[noteIndex]}/${newOctave}`;
    const newNote = { pitch: newPitch, duration: selectedDuration };
    const durationMap = { 'w': 4, 'h': 2, 'q': 1 };
    const noteDuration = durationMap[selectedDuration] || 1;
    const beatsPerMeasure = getBeatsPerMeasure();

    setMeasures(prevMeasures => {
      if (prevMeasures.length >= 100) {
        alert('Maximum number of measures reached.');
        return prevMeasures;
      }

      const newMeasures = [...prevMeasures];
      let lastMeasure;

      if (newMeasures.length > 0) {
        lastMeasure = { ...newMeasures[newMeasures.length - 1], notes: [...newMeasures[newMeasures.length - 1].notes] };
      } else {
        lastMeasure = { notes: [], duration: 0 };
      }

      if (lastMeasure.duration + noteDuration <= beatsPerMeasure) {
        lastMeasure.notes.push(newNote);
        lastMeasure.duration += noteDuration;
        if (newMeasures.length > 0) {
          newMeasures[newMeasures.length - 1] = lastMeasure;
        } else {
          newMeasures.push(lastMeasure);
        }
      } else {
        newMeasures.push({ notes: [newNote], duration: noteDuration });
      }

      if (newMeasures.length % measuresPerLine === 0 && newMeasures[newMeasures.length - 1].duration >= beatsPerMeasure) {
        newMeasures.push({ notes: [], duration: 0 });
      }

      // Play the newly added note with fixed eighth note duration
      playNote(newPitch);
      return newMeasures;
    });
  }, [isJianpuMode, selectedDuration, setMeasures, scoreRef, timeSignature, playNote]);

  const handleCanvasContextMenu = useCallback((event) => {
    event.preventDefault();
    if (isJianpuMode) return;
    const rect = scoreRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const note = getNoteAtPosition(x, y);
    if (!note) return;

    setMeasures(prevMeasures => {
      const newMeasures = [...prevMeasures];
      const measure = { ...newMeasures[note.measureIndex] };
      measure.notes = measure.notes.filter((_, i) => i !== note.noteIndex);
      measure.duration = measure.notes.reduce((sum, note) => sum + ({ 'w': 4, 'h': 2, 'q': 1 }[note.duration] || 1), 0);
      newMeasures[note.measureIndex] = measure;
      return newMeasures.filter(m => m.notes.length > 0 || m === newMeasures[newMeasures.length - 1]);
    });
  }, [isJianpuMode, measures, setMeasures, scoreRef, getNoteAtPosition]);

  useEffect(() => {
    if (scoreRef.current) {
      renderScore();
    }
  }, [renderScore]);

  useEffect(() => {
    const handleGlobalMouseUp = () => handleMouseUp();
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [handleMouseUp]);

  return (
    <div
      ref={scoreRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleCanvasClick}
      onContextMenu={handleCanvasContextMenu}
      style={{
        cursor: isDragging ? 'grabbing' : 'pointer',
        border: '1px solid #ccc',
        minHeight: '120px',
        width: '100%',
        backgroundColor: '#fff',
        userSelect: 'none',
      }}
    ></div>
  );
};

export default ScoreCanvas;