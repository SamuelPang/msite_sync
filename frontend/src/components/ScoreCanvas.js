import React, { useCallback, useState, useEffect } from 'react';
import { Renderer, Stave, StaveNote, Formatter, Voice, Barline } from 'vexflow';

const ScoreCanvas = ({ scoreRef, measures, setMeasures, isJianpuMode, jianpuInput, selectedDuration }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNote, setDraggedNote] = useState(null);
  const [dragStartY, setDragStartY] = useState(0);
  const measuresPerLine = 4; // 修改为每行6个小节
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
    const beatsPerMeasure = 4;
    const staveHeight = 100;

    // 计算每个小节的宽度，并取最大值作为统一宽度
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
      stave.addClef('treble').addTimeSignature('4/4');
      stave.setContext(context);
      stave.draw();
      staves.push(stave);
    } else {
      measures.forEach((measure, measureIndex) => {
        const measureQuarterNotes = measure.notes.reduce((sum, note) => sum + (durationMap[note.duration] || 1), 0);
        console.log(`Measure ${measureIndex} quarter notes: ${measureQuarterNotes}`);

        let vexNotes = measure.notes.map(note => {
          console.log('Creating note:', note);
          return new StaveNote({
            keys: [note.pitch === 'r' ? 'b/4' : note.pitch],
            duration: note.duration + (note.pitch === 'r' ? 'r' : ''),
          });
        });

        const remainingBeats = beatsPerMeasure - measureQuarterNotes;
        if (remainingBeats > 0) {
          console.log(`Adding ${remainingBeats} quarter rests to measure ${measureIndex}`);
          for (let i = 0; i < remainingBeats; i++) {
            vexNotes.push(new StaveNote({
              keys: ['b/4'],
              duration: 'qr',
            }));
          }
        }

        console.log(`VexNotes for measure ${measureIndex}:`, vexNotes.map(n => n.attrs));

        const lineIndex = Math.floor(measureIndex / measuresPerLine);
        const staveIndexInLine = measureIndex % measuresPerLine;
        const x = margin + staveIndexInLine * staveWidth;
        const y = 20 + lineIndex * staveHeight;

        const stave = new Stave(x, y, staveWidth);
        if (measureIndex === 0 || (measureIndex % measuresPerLine === 0)) {
          stave.addClef('treble').addTimeSignature('4/4');
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
        console.log(`Drawing barline after measure ${index}`);
        const barline = new Barline(Barline.type.SINGLE);
        barline.setContext(context).setStave(stave);
        barline.draw();
      }
    });

    if (voices.length > 0) {
      try {
        new Formatter().joinVoices(voices).format(voices, staveWidth - clefAndTimeWidth - 2 * margin);
        voices.forEach((voice, index) => {
          console.log(`Drawing voice for measure ${index}`);
          voice.draw(context, staves[index]);
        });
      } catch (error) {
        console.error('VexFlow rendering error:', error);
      }
    }

    if (isJianpuMode && jianpuInput) {
      context.setFont('Arial', 12).fillText(jianpuInput, margin, svgHeight - 10);
    }

    console.log('VexFlow Version:', Renderer.getVersion ? Renderer.getVersion() : 'Unknown');
    console.log('Rendered SVG:', targetDiv.innerHTML);
  }, [measures, isJianpuMode, jianpuInput, scoreRef]);

  const getNoteAtPosition = useCallback((x, y) => {
    if (measures.length === 0) return null;

    const defaultStaveWidth = 300;
    const margin = 10;
    const clefAndTimeWidth = 50;
    const staveHeight = 100;

    // 计算最大小节宽度（与 renderScore 保持一致）
    let maxStaveWidth = defaultStaveWidth;
    const durationMap = { 'w': 4, 'h': 2, 'q': 1 };
    measures.forEach(measure => {
      const measureQuarterNotes = measure.notes.reduce((sum, note) => sum + (durationMap[note.duration] || 1), 0);
      const measureNotes = measure.notes.length;
      const measureWidth = clefAndTimeWidth + measureQuarterNotes * 20 + measureNotes * 10 + 2 * margin;
      maxStaveWidth = Math.max(maxStaveWidth, measureWidth);
    });

    const staveWidth = maxStaveWidth;

    const lineIndex = Math.floor(y / staveHeight);
    const xInCanvas = x - margin;

    const staveIndexInLine = Math.floor(xInCanvas / staveWidth);
    const measureIndex = lineIndex * measuresPerLine + staveIndexInLine;

    if (measureIndex < 0 || measureIndex >= measures.length) {
      console.log(`Invalid measure index: ${measureIndex}`);
      return null;
    }

    const measure = measures[measureIndex];
    if (!measure.notes.length) return null;

    const staveX = margin + (measureIndex % measuresPerLine) * staveWidth;
    const usableWidth = staveWidth - clefAndTimeWidth - 2 * margin;

    const noteWidth = usableWidth / (measure.notes.length || 1);
    const noteIndex = Math.floor((x - staveX - clefAndTimeWidth) / noteWidth);

    if (noteIndex >= 0 && noteIndex < measure.notes.length) {
      console.log(`Selected note: measure ${measureIndex}, note ${noteIndex}`);
      return { measureIndex, noteIndex };
    }

    console.log(`No note found at x: ${x}, measure: ${measureIndex}, noteIndex: ${noteIndex}`);
    return null;
  }, [measures]);

  const calculatePitch = useCallback((y, rect) => {
    const staveTop = 60;
    const lineSpacing = 10;
    const staffHeight = 4 * lineSpacing;
    const staffBottom = staveTop + staffHeight;
    const tolerance = 15;

    if (y < staveTop - tolerance || y > staffBottom + tolerance) {
      console.log(`Y position outside staff bounds (y: ${y}, staveTop: ${staveTop}, staffBottom: ${staffBottom})`);
      return null;
    }

    const middleLineY = staveTop + 2 * lineSpacing;
    const yOffset = middleLineY - y;
    const halfSteps = Math.round(yOffset / (lineSpacing / 2));

    console.log(`yOffset: ${yOffset}, halfSteps: ${halfSteps}`);

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
      console.log(`Invalid octave: ${newOctave}`);
      return null;
    }

    return `${pitchNames[noteIndex]}/${newOctave}`;
  }, []);

  const handleMouseDown = useCallback((event) => {
    if (isJianpuMode) {
      console.log('Jianpu mode active, drag ignored.');
      return;
    }

    const rect = scoreRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    console.log(`Mouse down at (x: ${x}, y: ${y})`);

    const note = getNoteAtPosition(x, y);
    if (note && measures[note.measureIndex].notes[note.noteIndex].pitch !== 'r') {
      setIsDragging(true);
      setDraggedNote(note);
      setDragStartY(y);
      console.log(`Dragging note at measure ${note.measureIndex}, note ${note.noteIndex}`);
    } else {
      console.log('No valid note selected for dragging');
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
        return newMeasures;
      });
    }
  }, [isDragging, draggedNote, calculatePitch, setMeasures]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setDraggedNote(null);
      setDragStartY(0);
      console.log('Drag ended');
    }
  }, [isDragging]);

  const handleCanvasClick = useCallback((event) => {
    if (isJianpuMode) {
      console.log('Jianpu mode active, click ignored.');
      return;
    }

    const rect = scoreRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    console.log(`Click at (x: ${x}, y: ${y})`);

    const staveTop = 60;
    const lineSpacing = 10;
    const staffHeight = 4 * lineSpacing;
    const staffBottom = staveTop + staffHeight;
    const tolerance = 15;

    if (y < staveTop - tolerance || y > staffBottom + tolerance) {
      console.log(`Click outside staff bounds (y: ${y}, staveTop: ${staveTop}, staffBottom: ${staffBottom})`);
      return;
    }

    const middleLineY = staveTop + 2 * lineSpacing;
    const yOffset = middleLineY - y;
    const halfSteps = Math.round(yOffset / (lineSpacing / 2));

    console.log(`yOffset: ${yOffset}, halfSteps: ${halfSteps}`);

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
      console.log(`Invalid octave: ${newOctave}`);
      return;
    }

    const newPitch = `${pitchNames[noteIndex]}/${newOctave}`;
    console.log(`Calculated pitch: ${newPitch}, duration: ${selectedDuration}`);

    const newNote = { pitch: newPitch, duration: selectedDuration };
    const durationMap = { 'w': 4, 'h': 2, 'q': 1 };
    const noteDuration = durationMap[selectedDuration] || 1;
    const beatsPerMeasure = 4;

    setMeasures(prevMeasures => {
      console.log('Previous measures:', JSON.stringify(prevMeasures, null, 2));

      if (prevMeasures.length >= 100) {
        console.log('Maximum number of measures reached.');
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

      console.log('Last measure before update:', JSON.stringify(lastMeasure, null, 2));

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

      // 检查是否是第六个小节且已满
      if (newMeasures.length % measuresPerLine === 0 && newMeasures[newMeasures.length - 1].duration >= beatsPerMeasure) {
        console.log('Sixth measure filled, adding new empty measure for new line');
        newMeasures.push({ notes: [], duration: 0 });
      }

      console.log('New measures after update:', JSON.stringify(newMeasures, null, 2));
      return newMeasures;
    });
  }, [isJianpuMode, selectedDuration, setMeasures, scoreRef]);

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