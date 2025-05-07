import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Renderer, Stave, StaveNote, Formatter, Voice, Barline } from 'vexflow';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const MAX_MEASURES = 100;
const MAX_AUDIO_CHUNKS = 1000;
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

  useEffect(() => {
    renderScore();
    return () => {
      if (recordedAudio) {
        URL.revokeObjectURL(recordedAudio);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [measures, isJianpuMode, recordedAudio]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0 && audioChunksRef.current.length < MAX_AUDIO_CHUNKS) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        if (audioChunksRef.current.length === 0) {
          alert('No audio recorded.');
          return;
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        if (recordedAudio) {
          URL.revokeObjectURL(recordedAudio);
        }
        setRecordedAudio(audioUrl);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.onerror = () => {
        alert('Recording error occurred.');
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please ensure microphone access is granted.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current || !recordedAudio) {
      alert('No audio available to play.');
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(error => {
        console.error('Error playing audio:', error);
        alert('Failed to play recorded audio.');
      });
      setIsPlaying(true);
    }
  };

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
        if (newMeasures.length < MAX_MEASURES) {
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

    if (currentMeasure.notes.length > 0 && newMeasures.length < MAX_MEASURES) {
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
  }, [parseJianpu]);

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

      if (prevMeasures.length >= MAX_MEASURES) {
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
  }, [isJianpuMode, selectedDuration]);

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
  }, [isJianpuMode, measures]);

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
  }, [isJianpuMode, measures]);

  const playScore = async () => {
    try {
      const flatNotes = measures.flatMap(measure => measure.notes);
      if (flatNotes.length === 0) {
        alert('No notes to play.');
        return;
      }

      const scoreData = { title, tracks: [{ notes: flatNotes }] };
      const saveResponse = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/scores/`, scoreData);
      const currentScoreId = saveResponse.data.id;
      setScoreId(currentScoreId);

      const exportResponse = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/scores/${currentScoreId}/export`,
        { track_id: 0, start: 0, end: flatNotes.length, format: 'mp3', instrument: selectedInstrument, tempo }
      );

      const fileUrl = `${process.env.REACT_APP_BACKEND_URL}/${exportResponse.data.file_path}`;
      const audio = new Audio(fileUrl);
      await audio.play();
    } catch (error) {
      console.error('Error playing score:', error);
      alert('Failed to play score. Please try again.');
    }
  };

  const saveScore = async () => {
    try {
      const flatNotes = measures.flatMap(measure => measure.notes);
      if (flatNotes.length === 0) {
        alert('No notes to save.');
        return null;
      }

      const scoreData = { title, tracks: [{ notes: flatNotes }] };
      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/scores/`, scoreData);
      setScoreId(response.data.id);
      alert('Score saved!');
      return response.data.id;
    } catch (error) {
      console.error('Error saving score:', error);
      alert('Failed to save score. Please try again.');
      throw error;
    }
  };

  const exportScore = async (format) => {
    try {
      if (format === 'pdf') {
        let targetDiv = scoreRef.current;
        let svgElement = targetDiv.querySelector('svg');

        // If the visible SVG is empty or missing, try rendering to a temp div
        if (!svgElement || !svgElement.querySelector('.vf-stavenote')) {
          console.log('Visible SVG missing content, rendering to temp div');
          const tempDiv = document.createElement('div');
          tempDiv.style.position = 'absolute';
          tempDiv.style.left = '0';
          tempDiv.style.top = '0';
          tempDiv.style.visibility = 'visible'; // Ensure visibility for rendering
          document.body.appendChild(tempDiv);

          renderScore(tempDiv);
          svgElement = tempDiv.querySelector('svg');

          if (!svgElement) {
            document.body.removeChild(tempDiv);
            throw new Error('Score SVG not found.');
          }
        }

        // Log SVG content for debugging
        console.log('SVG content for PDF:', svgElement.outerHTML);
        console.log('Clefs in SVG:', svgElement.querySelectorAll('.vf-clef').length);
        console.log('Time signatures in SVG:', svgElement.querySelectorAll('.vf-timesignature').length);
        console.log('Notes in SVG:', svgElement.querySelectorAll('.vf-stavenote').length);
        console.log('Barlines in SVG:', svgElement.querySelectorAll('.vf-stavebarline').length);

        // Get SVG dimensions
        const defaultStaveWidth = 300;
        const pixelsPerQuarterNote = 20;
        const noteSpacing = 10;
        const durationMap = { 'w': 4, 'h': 2, 'q': 1 };
        const margin = 10;
        const clefAndTimeWidth = 50;
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

        // Use html2canvas to convert SVG to canvas
        const canvas = await html2canvas(targetDiv, {
          width: svgWidth + 20,
          height: svgHeight,
          scale: 2, // Increase resolution for better quality
        });

        console.log('Canvas generated:', canvas.toDataURL('image/png'));

        const doc = new jsPDF({
          orientation: svgWidth > svgHeight ? 'landscape' : 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        // A4 dimensions: 210mm x 297mm
        const pageWidth = 210;
        const pageHeight = 297;
        const maxWidth = pageWidth - 2 * margin;
        const maxHeight = pageHeight - 2 * margin;

        // Calculate PDF dimensions
        const svgAspectRatio = svgWidth / svgHeight;
        let pdfWidth = maxWidth;
        let pdfHeight = pdfWidth / svgAspectRatio;

        if (pdfHeight > maxHeight) {
          pdfHeight = maxHeight;
          pdfWidth = pdfHeight * svgAspectRatio;
        }

        console.log(`PDF dimensions: width=${pdfWidth}mm, height=${pdfHeight}mm`);

        // Convert canvas to image and add to PDF
        const imgData = canvas.toDataURL('image/png');
        doc.addImage(
          imgData,
          'PNG',
          margin + (maxWidth - pdfWidth) / 2, // Center horizontally
          margin + (maxHeight - pdfHeight) / 2, // Center vertically
          pdfWidth,
          pdfHeight
        );

        const pdfBlob = doc.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${title || 'score'}.pdf`;
        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        if (targetDiv !== scoreRef.current) {
          document.body.removeChild(targetDiv);
        }
        URL.revokeObjectURL(url);

        alert('PDF exported successfully!');
      } else {
        let currentScoreId = scoreId;
        if (!currentScoreId) {
          currentScoreId = await saveScore();
          if (!currentScoreId) return;
        }

        const flatNotes = measures.flatMap(measure => measure.notes);
        if (flatNotes.length === 0) {
          alert('No notes to export.');
          return;
        }

        const response = await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/api/scores/${currentScoreId}/export`,
          { track_id: 0, start: 0, end: flatNotes.length, format, instrument: selectedInstrument, tempo }
        );

        const fileUrl = `${process.env.REACT_APP_BACKEND_URL}/${response.data.file_path}`;
        const fileResponse = await fetch(fileUrl);
        if (!fileResponse.ok) {
          throw new Error(`Failed to fetch file: ${fileResponse.statusText}`);
        }
        const blob = await fileResponse.blob();

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${title || 'score'}.${format === 'musicxml' ? 'xml' : format}`;
        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        alert(`${format.toUpperCase()} exported successfully!`);
      }
    } catch (error) {
      console.error(`Error exporting ${format}:`, error);
      alert(`Failed to export ${format}: ${error.message}`);
      throw error;
    }
  };

  const noteButtons = useMemo(() => {
    return measures.flatMap((measure, mIndex) =>
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
  }, [measures, handleNoteClick]);

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
        <label>
          <input
            type="checkbox"
            checked={isJianpuMode}
            onChange={(e) => setIsJianpuMode(e.target.checked)}
          /> Use Jianpu Mode
        </label>
      </div>
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
            onClick={() => setSelectedDuration('q')}
            style={{ margin: '5px', background: selectedDuration === 'q' ? '#ccc' : '#fff' }}
          >
            Quarter
          </button>
        </div>
      )}
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
      <div style={{ marginBottom: '10px' }}>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          style={{ margin: '5px', background: isRecording ? '#f88' : '#fff' }}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
        {recordedAudio && (
          <div style={{ marginTop: '10px' }}>
            <audio
              ref={audioRef}
              src={recordedAudio}
              onEnded={() => setIsPlaying(false)}
            />
            <button
              onClick={togglePlayPause}
              style={{ margin: '5px' }}
            >
              {isPlaying ? 'Pause' : 'Play'} Recorded Audio
            </button>
          </div>
        )}
      </div>
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
      <div>{noteButtons}</div>
      <button onClick={saveScore} style={{ margin: '10px' }}>
        Save Score
      </button>
      <button onClick={playScore} style={{ margin: '10px' }}>
        Play Score
      </button>
      <button onClick={() => exportScore('musicxml')} style={{ margin: '10px' }}>
        Export MusicXML
      </button>
      <button onClick={() => exportScore('png')} style={{ margin: '10px' }}>
        Export PNG
      </button>
      <button onClick={() => exportScore('pdf')} style={{ margin: '10px' }}>
        Export PDF
      </button>
      <button onClick={() => exportScore('mp3')} style={{ margin: '10px' }}>
        Export MP3
      </button>
    </div>
  );
};

export default ScoreEditor;