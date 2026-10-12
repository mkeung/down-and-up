import { afterEach, expect, it, vi } from 'vitest';
import { nextIdle, nextWalk } from './cerberus-motion';

afterEach(() => vi.restoreAllMocks());

it('walks in either direction, stops at the edges, and never chooses a zero-distance leg', () => {
  for (const random of [0, 0.49, 0.5, 0.99]) {
    vi.spyOn(Math, 'random').mockReturnValue(random);
    for (const position of [0, 0.04, 0.1, 0.5, 0.9, 0.96, 1]) {
      const walk = nextWalk(position, 120);
      expect(walk.animation).toBe('walking');
      expect(walk.target).toBeGreaterThanOrEqual(0);
      expect(walk.target).toBeLessThanOrEqual(1);
      expect(walk.target).not.toBe(position);
      expect(walk.facingRight).toBe(walk.target > position);
      expect(walk.remaining).toBeGreaterThanOrEqual(800);
    }
  }
});

it('chooses ordinary or longer sitting pauses while preserving the stopping point and facing', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  const walk = nextWalk(0.5, 120);
  const normal = nextIdle(walk);
  expect(normal.animation).toBe('sitting-idle');
  expect(normal.remaining).toBe(7000);
  vi.mocked(Math.random)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0.5);
  const longer = nextIdle(walk);
  expect(longer.remaining).toBe(22000);
  expect(longer.target).toBe(walk.target);
  expect(longer.facingRight).toBe(walk.facingRight);
});

it.each([
  [0.7, 'tennis-ball'],
  [0.9, 'yarn-ball'],
])('chooses ball play independently of entries (%s)', (choice, animation) => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  const walk = nextWalk(0.5, 120);
  vi.mocked(Math.random).mockReturnValueOnce(choice);
  const idle = nextIdle(walk);
  expect(idle.animation).toBe(animation);
  expect(idle.remaining).toBe(6750);
  expect(idle.target).toBe(walk.target);
  expect(idle.facingRight).toBe(walk.facingRight);
});
