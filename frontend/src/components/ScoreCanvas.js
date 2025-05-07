import React, { useCallback } from 'react';
import { Renderer, Stave, StaveNote, Formatter, Voice, Barline } from 'vexflow';

const ScoreCanvas = ({ scoreRef, measures, setMeasures, isJianpuMode, jianpuInput, selectedDuration }) => {
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
    const measuresPerLine = 4;

    const totalQuarterNotes = measures.reduce((sum, measure) => {
      return sum + measure.notes.reduce((mSum, note) => mSum + (durationMap[note.duration] || 1), 0);
    }, 0);
    const totalNotes = measures.reduce((sum, measure) => sum + measure.notes.length, 0);
    const staveWidth = Math.max(
      defaultStaveWidth,
      clefAndTimeWidth + totalQuarterNotes * pixelsPerQuarterNote + totalNotes * noteSpacing + 2 * margin
    );

    const numLines = Math.ceil(measures.length / measuresPerLine);
    const svgWidth = staveWidth * Math.min(measures.length, measuresPerLine);
    const svgHeight = staveHeight * numLines + 20;

    const renderer = new Renderer(targetDiv, Renderer.Backends.SVG);
    renderer.resize(svgWidth + 20, svgHeight);
    const context = renderer.getContext();
    context.setFillStyle('#000000');
    context.setStrokeStyle('#000000');
    context.scale(1, 1);

    const voices = [];
    const staves = [];

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
      if (measureIndex === 0) {
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

    staves.forEach((stave, index) => {
      stave.draw();
      if (index < staves.length - 1) {
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
  }, [measures, isJianpuMode, jianpuInput]);

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

      console.log('New measures after update:', JSON.stringify(newMeasures, null, 2));
      return newMeasures;
    });
  }, [isJianpuMode, selectedDuration, setMeasures, scoreRef]);

  const handleCanvasContextMenu = useCallback((event) => {
    event.preventDefault();
    if (isJianpuMode) return;
    const rect = scoreRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const totalNotes = measures.reduce((sum, m) => sum + m.notes.length, 0);
    if (totalNotes === 0) return;

    const noteWidth = 400 / (totalNotes + 1);
    let noteIndex = Math.floor(x / noteWidth);
    let measureIndex = 0;

    let currentNoteCount = 0;
    for (let i = 0; i < measures.length; i++) {
      if (noteIndex < currentNoteCount + measures[i].notes.length) {
        measureIndex = i;
        noteIndex -= currentNoteCount;
        break;
      }
      currentNoteCount += measures[i].notes.length;
    }

    if (noteIndex >= 0 && noteIndex < measures[measureIndex].notes.length) {
      setMeasures(prevMeasures => {
        const newMeasures = [...prevMeasures];
        const measure = { ...newMeasures[measureIndex] };
        measure.notes = measure.notes.filter((_, i) => i !== noteIndex);
        measure.duration = measure.notes.reduce((sum, note) => sum + ({ 'w': 4, 'h': 2, 'q': 1 }[note.duration] || 1), 0);
        newMeasures[measureIndex] = measure;
        return newMeasures.filter(m => m.notes.length > 0);
      });
    }
  }, [isJianpuMode, measures, setMeasures, scoreRef]);

  React.useEffect(() => {
    renderScore();
  }, [renderScore]);

  return (
    <div
      ref={scoreRef}
      onClick={handleCanvasClick}
      onContextMenu={handleCanvasContextMenu}
      style={{
        cursor: 'pointer',
        border: '1px solid #ccc',
        minHeight: '120px',
        width: '100%',
        backgroundColor: '#fff',
      }}
    ></div>
  );
};

export default ScoreCanvas;