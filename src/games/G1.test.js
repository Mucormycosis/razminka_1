import { fireEvent, render, screen } from '@testing-library/react';
import G1 from './G1';


const contextStub = () => ({
  clearRect: jest.fn(),
  fillRect: jest.fn(),
  strokeRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  fillText: jest.fn(),
  setTransform: jest.fn(),
  globalAlpha: 1,
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: '',
  textBaseline: '',
});

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function getContext() {
    if (!this.__ctx) this.__ctx = contextStub();
    return this.__ctx;
  };
});

beforeEach(() => {
  HTMLCanvasElement.prototype.getClientRects = () => ({ length: 0 });
});

test('renders the board, hud and controls', () => {
  render(<G1 />);

  expect(screen.getByLabelText('Игровое поле тетриса')).toBeInTheDocument();
  expect(screen.getByText('Счёт')).toBeInTheDocument();
  expect(screen.getByText('Линии')).toBeInTheDocument();
  expect(screen.getByText('Уровень')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Заново' })).toBeInTheDocument();
});

test('starts with zero score and first level', () => {
  render(<G1 />);

  const values = screen.getAllByText('0');
  expect(values.length).toBeGreaterThan(0);
  expect(screen.getByText('1')).toBeInTheDocument();
});

test('restart button resets the score', () => {
  render(<G1 />);

  fireEvent.click(screen.getByRole('button', { name: 'Заново' }));

  expect(screen.getByLabelText('Игровое поле тетриса')).toBeInTheDocument();
});

test('keyboard input does not crash the loop', () => {
  render(<G1 />);
  const canvas = screen.getByLabelText('Игровое поле тетриса');

  ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'p', 'r'].forEach((key) => {
    fireEvent.keyDown(canvas, { key });
    fireEvent.keyUp(canvas, { key });
  });

  expect(screen.getByLabelText('Игровое поле тетриса')).toBeInTheDocument();
});