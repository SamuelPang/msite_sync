import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ScoreEditor from './components/ScoreEditor';
import ScorePlayer from './components/ScorePlayer';
import ScoreExporter from './components/ScoreExporter';
import { Container } from '@mui/material';

function App() {
  return (
    <Router>
      <Container>
        <Routes>
          <Route path="/" element={<ScoreEditor />} />
          <Route path="/play/:scoreId" element={<ScorePlayer />} />
          <Route path="/export/:scoreId" element={<ScoreExporter />} />
        </Routes>
      </Container>
    </Router>
  );
}

export default App;