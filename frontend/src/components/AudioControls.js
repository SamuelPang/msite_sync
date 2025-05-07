import React from 'react';

const AudioControls = ({
  isRecording,
  setIsRecording,
  recordedAudio,
  setRecordedAudio,
  isPlaying,
  setIsPlaying,
  mediaRecorderRef,
  audioChunksRef,
  audioRef,
}) => {
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0 && audioChunksRef.current.length < 1000) {
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

  return (
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
  );
};

export default AudioControls;