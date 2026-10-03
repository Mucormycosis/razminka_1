import WaveField from './WaveField';
import '../Background.css';

export default function Background({ paused = false }) {
  return (
    <div className={`sky${paused ? ' is-paused' : ''}`} aria-hidden="true">
      <div className="ripples">
        <WaveField paused={paused} />
      </div>
    </div>
  );
}