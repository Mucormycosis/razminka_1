import { act, fireEvent, render, screen } from '@testing-library/react';
import G4 from './G4';

const MAP = { '↑': 'ArrowUp', '↓': 'ArrowDown', '←': 'ArrowLeft', '→': 'ArrowRight' };

function keyDown(key, extra) {
  return act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));
  });
}

function keyUp(key) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
  });
}

/** Нажимает ту стрелку, которая сейчас показана на экране */
function pressShown() {
  const glyph = document.querySelector('.g4__glyph');
  if (!glyph) return null;
  const key = MAP[glyph.textContent];
  keyDown(key);
  keyUp(key);
  return key;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test('shows the start screen, difficulty choice and rules', () => {
  render(<G4 />);

  expect(screen.getByText('Reaction Arrows')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Играть' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Сложность' })).toBeInTheDocument();
  ['Легко', 'Норма', 'Сложно'].forEach((name) => {
    expect(screen.getByRole('button', { name })).toBeInTheDocument();
  });
});

test('difficulty is selectable', () => {
  render(<G4 />);

  const hard = screen.getByRole('button', { name: 'Сложно' });
  act(() => fireEvent.click(hard));

  expect(hard).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Норма' })).toHaveAttribute('aria-pressed', 'false');
});

test('start button switches to the round screen with a zeroed hud', () => {
  render(<G4 />);
  act(() => fireEvent.click(screen.getByRole('button', { name: 'Играть' })));

  expect(screen.queryByText('Reaction Arrows')).not.toBeInTheDocument();
  expect(screen.getByText('Готовься…')).toBeInTheDocument();
  expect(screen.getByText('Счёт')).toBeInTheDocument();
  expect(screen.getByText('Комбо')).toBeInTheDocument();
  expect(screen.getByText('Время')).toBeInTheDocument();
  expect(screen.getByText('Жизни')).toBeInTheDocument();
});

test('an arrow appears after the first delay and is removed by the right key', () => {
  render(<G4 />);
  act(() => fireEvent.click(screen.getByRole('button', { name: 'Играть' })));

  expect(document.querySelector('.g4__glyph')).toBeNull();
  act(() => jest.advanceTimersByTime(1200));
  expect(document.querySelector('.g4__glyph')).not.toBeNull();

  const key = pressShown();
  expect(key).not.toBeNull();
  expect(document.querySelector('.g4__glyph')).toBeNull();
});

test('arrow keys are swallowed so the page does not scroll', () => {
  render(<G4 />);
  act(() => fireEvent.click(screen.getByRole('button', { name: 'Играть' })));

  const events = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].map((key) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    window.dispatchEvent(new KeyboardEvent('keyup', { key }));
    return event;
  });

  expect(events.every((e) => e.defaultPrevented)).toBe(true);
});

test('a held key fires the press only once', () => {
  render(<G4 />);
  act(() => fireEvent.click(screen.getByRole('button', { name: 'Играть' })));
  act(() => jest.advanceTimersByTime(1200));

  const glyph = document.querySelector('.g4__glyph');
  expect(glyph).not.toBeNull();
  const key = MAP[glyph.textContent];

  // keyup не приходит, а keydown сыпется автоповторами
  keyDown(key, { repeat: true });
  keyDown(key, { repeat: true });
  keyDown(key, { repeat: true });

  // стрелка всё ещё на экране — ни одно из «повторных» нажатий не сработало
  expect(document.querySelector('.g4__glyph')).not.toBeNull();

  keyUp(key);
});

test('keyboard input does not crash the loop', () => {
  render(<G4 />);
  act(() => fireEvent.click(screen.getByRole('button', { name: 'Играть' })));

  ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'p', 'r', 'Enter'].forEach((key) => {
    keyDown(key);
    keyUp(key);
  });

  act(() => jest.advanceTimersByTime(2000));
  expect(screen.getByText('Время')).toBeInTheDocument();
});

test('restart brings the round back to a clean state', () => {
  render(<G4 />);
  act(() => fireEvent.click(screen.getByRole('button', { name: 'Играть' })));
  act(() => jest.advanceTimersByTime(1200));

  expect(document.querySelector('.g4__glyph')).not.toBeNull();

  act(() => fireEvent.click(screen.getByRole('button', { name: 'Начать заново' })));

  expect(document.querySelector('.g4__glyph')).toBeNull();
  expect(screen.getByText('Счёт')).toBeInTheDocument();
});

test('round ends and shows results', () => {
  render(<G4 />);
  act(() => fireEvent.click(screen.getByRole('button', { name: 'Играть' })));
  act(() => jest.advanceTimersByTime(31000));

  // без нажатий стрелки успевают истечь трижды — раунд кончается по жизням
  expect(screen.getByText('Жизни закончились')).toBeInTheDocument();
  expect(screen.getByText('очков')).toBeInTheDocument();
  expect(screen.getByText('Промахов')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Играть снова' }).length).toBeGreaterThan(0);
});

test('hitting arrows keeps the round alive to the timer', () => {
  render(<G4 />);
  act(() => fireEvent.click(screen.getByRole('button', { name: 'Играть' })));

  // 30 секунд «игры»: каждую показанную стрелку сразу нажимаем правильно
  for (let elapsed = 0; elapsed < 30000; elapsed += 200) {
    act(() => jest.advanceTimersByTime(200));
    pressShown();
  }

  expect(screen.getByText('Время вышло')).toBeInTheDocument();
  expect(screen.getByText('Точных попаданий')).toBeInTheDocument();
});
