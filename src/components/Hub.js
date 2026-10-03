import { useCallback, useEffect, useState } from 'react';
import G1 from '../games/G1';
import G2 from '../games/G2';
import G3 from '../games/G3';
import G4 from '../games/G4';

const GAMES = { G1, G2, G3, G4 };

export default function Hub({ activeGame, onSelect }) {
  const [revealed, setRevealed] = useState(false);

  const close = useCallback(() => onSelect(null), [onSelect]);

  useEffect(() => {
    if (!activeGame) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') close();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeGame, close]);

  const Game = activeGame ? GAMES[activeGame] : null;

  return (
    <div className="stage">
      <div
        className={`hub${revealed ? ' is-revealed' : ''}`}
        data-testid="hub"
        onMouseEnter={() => setRevealed(true)}
        onMouseLeave={() => setRevealed(false)}
      >
        <div className="hub__cells">
          {Object.keys(GAMES).map((key, i) => (
            <button
              key={key}
              type="button"
              className={`cell cell--${i + 1}`}
              style={{ '--delay': `${i * 100}ms` }}
              onClick={() => onSelect(key)}
              aria-label={key}
            >
              {key}
            </button>
          ))}
        </div>

        <button type="button" className="core" aria-label="menu" />
      </div>

      {Game && (
        <div className="stage__game">
          <Game />
        </div>
      )}
    </div>
  );
}