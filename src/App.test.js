import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

test('renders central button and four cells', () => {
  render(<App />);
  expect(screen.getByLabelText('menu')).toBeInTheDocument();
  ['G1', 'G2', 'G3', 'G4'].forEach((key) => {
    expect(screen.getByLabelText(key)).toBeInTheDocument();
  });
});

test('cells appear on hover over hub', () => {
  render(<App />);
  const hub = screen.getByTestId('hub');
  fireEvent.mouseEnter(hub);
  expect(hub.classList.contains('is-revealed')).toBe(true);
  fireEvent.mouseLeave(hub);
  expect(hub.classList.contains('is-revealed')).toBe(false);
});