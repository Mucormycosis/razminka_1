import WaveField from './WaveField';
import '../Background.css';

export default function Background() {
  return (
    <div className="sky" aria-hidden="true">
      <div className="ripples">
        <WaveField />
      </div>
    </div>
  );
}