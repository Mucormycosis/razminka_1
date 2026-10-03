import { useState } from 'react';
import Hub from './components/Hub';
import Background from './components/Background';
import './App.css';

function App() {
  const [activeGame, setActiveGame] = useState(null);

  return (
    <div className="App">
      <Background paused={Boolean(activeGame)} />
      <Hub activeGame={activeGame} onSelect={setActiveGame} />
    </div>
  );
}

export default App;