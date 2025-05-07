import React from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const ScoreControls = ({ measures, title, scoreId, setScoreId, selectedInstrument, tempo, scoreRef }) => {
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

  const exportScore = async (format) => {
    try {
      if (format === 'pdf') {
        let targetDiv = scoreRef.current;
        let svgElement = targetDiv.querySelector('svg');

        if (!svgElement || !svgElement.querySelector('.vf-stavenote')) {
          console.log('Visible SVG missing content, rendering to temp div');
          const tempDiv = document.createElement('div');
          tempDiv.style.position = 'absolute';
          tempDiv.style.left = '0';
          tempDiv.style.top = '0';
          tempDiv.style.visibility = 'visible';
          document.body.appendChild(tempDiv);

          // Note: renderScore is not accessible here, so assume it's handled externally
          svgElement = tempDiv.querySelector('svg');

          if (!svgElement) {
            document.body.removeChild(tempDiv);
            throw new Error('Score SVG not found.');
          }
        }

        console.log('SVG content for PDF:', svgElement.outerHTML);
        console.log('Clefs in SVG:', svgElement.querySelectorAll('.vf-clef').length);
        console.log('Time signatures in SVG:', svgElement.querySelectorAll('.vf-timesignature').length);
        console.log('Notes in SVG:', svgElement.querySelectorAll('.vf-stavenote').length);
        console.log('Barlines in SVG:', svgElement.querySelectorAll('.vf-stavebarline').length);

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

        const canvas = await html2canvas(targetDiv, {
          width: svgWidth + 20,
          height: svgHeight,
          scale: 2,
        });

        console.log('Canvas generated:', canvas.toDataURL('image/png'));

        const doc = new jsPDF({
          orientation: svgWidth > svgHeight ? 'landscape' : 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        const pageWidth = 210;
        const pageHeight = 297;
        const maxWidth = pageWidth - 2 * margin;
        const maxHeight = pageHeight - 2 * margin;

        const svgAspectRatio = svgWidth / svgHeight;
        let pdfWidth = maxWidth;
        let pdfHeight = pdfWidth / svgAspectRatio;

        if (pdfHeight > maxHeight) {
          pdfHeight = maxHeight;
          pdfWidth = pdfHeight * svgAspectRatio;
        }

        console.log(`PDF dimensions: width=${pdfWidth}mm, height=${pdfHeight}mm`);

        const imgData = canvas.toDataURL('image/png');
        doc.addImage(
          imgData,
          'PNG',
          margin + (maxWidth - pdfWidth) / 2,
          margin + (maxHeight - pdfHeight) / 2,
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

  return (
    <div>
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

export default ScoreControls;