import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  created: [] as {
    source: unknown;
    volume: number;
    seekTo: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
  }[],
  setAudioModeAsync: vi.fn(),
}));
vi.mock('expo-audio', () => ({
  createAudioPlayer: (source: unknown) => {
    const player = {
      source,
      volume: 1,
      seekTo: vi.fn().mockResolvedValue(undefined),
      play: vi.fn(),
    };
    mocks.created.push(player);
    return player;
  },
  setAudioModeAsync: mocks.setAudioModeAsync,
}));
vi.mock('../assets/sounds/click.wav', () => ({ default: 1 }));
vi.mock('../assets/sounds/pom-bark.wav', () => ({ default: 2 }));
vi.mock('../assets/sounds/dog-bark.wav', () => ({ default: 3 }));
vi.mock('../assets/sounds/meow-a.wav', () => ({ default: 4 }));
vi.mock('../assets/sounds/meow-b.wav', () => ({ default: 5 }));

async function load() {
  vi.resetModules();
  return import('./sounds');
}
beforeEach(() => {
  vi.useFakeTimers();
  mocks.created.length = 0;
  mocks.setAudioModeAsync.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('respects silent mode, mixes with other audio, and reuses one player per clip', async () => {
  const { playSound } = await load();
  playSound('click');
  playSound('click');
  await vi.runAllTimersAsync();
  expect(mocks.setAudioModeAsync).toHaveBeenCalledExactlyOnceWith({
    playsInSilentMode: false,
    interruptionMode: 'mixWithOthers',
  });
  expect(mocks.created).toHaveLength(1);
  const [click] = mocks.created;
  expect(click).toMatchObject({ source: 1, volume: 0.5 });
  expect(click!.seekTo).toHaveBeenCalledWith(0);
  expect(click!.play).toHaveBeenCalledTimes(2);
});

it('skips a clip that fails instead of throwing', async () => {
  const { playSound } = await load();
  mocks.setAudioModeAsync.mockRejectedValue(new Error('No audio session'));
  playSound('dogBark');
  mocks.created[0]!.seekTo.mockRejectedValue(new Error('Unloaded'));
  expect(() => playSound('dogBark')).not.toThrow();
  await vi.runAllTimersAsync();
  expect(mocks.created[0]!.play).toHaveBeenCalledTimes(1);
});

it('barks for the tennis ball, meows for the yarn, and uses both for food', async () => {
  const { soundCues } = await load();
  const sounds = (animation: Parameters<typeof soundCues>[0]) =>
    soundCues(animation).map((cue) => cue.sound);
  vi.spyOn(Math, 'random').mockReturnValue(0.9);
  expect(sounds('tennis-ball')).toEqual(['pomBark', 'dogBark']);
  expect(sounds('yarn-ball')).toEqual(['meowB']);
  expect(sounds('food-can')).toEqual(['dogBark', 'pomBark', 'meowB']);
  vi.mocked(Math.random).mockReturnValue(0);
  expect(sounds('yarn-ball')).toEqual(['meowA']);
  for (const quiet of ['walking', 'sitting-idle', 'reaction-01'] as const)
    expect(soundCues(quiet)).toEqual([]);
});

it('plays cues at their offsets and cancels the ones not yet heard', async () => {
  const { cueAnimationSounds } = await load();
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const cancel = cueAnimationSounds('food-can');
  await vi.advanceTimersByTimeAsync(500);
  expect(mocks.created.map((player) => player.source)).toEqual([3]);
  cancel();
  await vi.runAllTimersAsync();
  expect(mocks.created).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
});
