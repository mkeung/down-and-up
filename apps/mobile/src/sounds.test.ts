import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  created: [] as {
    source: unknown;
    volume: number;
    seekTo: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
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
      pause: vi.fn(),
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
  const sounds = await import('./sounds');
  sounds.setSoundPreferences({ muted: false, volume: 1 });
  return sounds;
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
  // A failed rewind is swallowed; the clip still plays from where it is.
  expect(mocks.created[0]!.play).toHaveBeenCalledTimes(2);
  mocks.created[0]!.play.mockImplementation(() => {
    throw new Error('Released');
  });
  expect(() => playSound('dogBark')).not.toThrow();
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

it.each([
  [0, 4],
  [0.9, 5],
])(
  'barks at backflip start and meows on the final recovery pose (%s)',
  async (random, meow) => {
    const { cueAnimationSounds } = await load();
    vi.spyOn(Math, 'random').mockReturnValue(random);
    cueAnimationSounds('backflip');
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.created.map((player) => player.source)).toEqual([3]);
    expect(mocks.created[0]!.play).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1139);
    expect(mocks.created).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.created.map((player) => player.source)).toEqual([3, meow]);
    expect(mocks.created[1]!.play).toHaveBeenCalledTimes(1);
    await vi.runAllTimersAsync();
    expect(vi.getTimerCount()).toBe(0);
  },
);

it('cancels the closing meow when backflip playback is interrupted', async () => {
  const { cueAnimationSounds } = await load();
  const cancel = cueAnimationSounds('backflip');
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.created.map((player) => player.source)).toEqual([3]);
  cancel();
  await vi.runAllTimersAsync();
  expect(mocks.created).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
});

it('scales existing and newly created players by the master volume', async () => {
  const { playSound, setSoundPreferences } = await load();
  playSound('click');
  await vi.runAllTimersAsync();
  setSoundPreferences({ muted: false, volume: 0.4 });
  expect(mocks.created[0]!.volume).toBe(0.2);
  playSound('dogBark');
  await vi.runAllTimersAsync();
  expect(mocks.created[1]!.volume).toBeCloseTo(0.28);
});

it.each([null, { muted: true, volume: 0.8 }, { muted: false, volume: 0 }])(
  'skips playback and cues while preferences are %s',
  async (preference) => {
    const { playSound, setSoundPreferences, cueAnimationSounds } = await load();
    setSoundPreferences(preference);
    playSound('click');
    cueAnimationSounds('food-can');
    cueAnimationSounds('backflip');
    await vi.runAllTimersAsync();
    expect(mocks.created).toHaveLength(0);
    expect(mocks.setAudioModeAsync).not.toHaveBeenCalled();
  },
);

it('mute pauses active clips and cancels outstanding animation cues', async () => {
  const { playSound, setSoundPreferences, cueAnimationSounds } = await load();
  playSound('dogBark');
  cueAnimationSounds('food-can');
  await vi.advanceTimersByTimeAsync(100);
  setSoundPreferences({ muted: true, volume: 0.6 });
  expect(mocks.created[0]!.pause).toHaveBeenCalledTimes(1);
  expect(mocks.created[0]!.volume).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
  setSoundPreferences({ muted: false, volume: 0.6 });
  await vi.runAllTimersAsync();
  expect(mocks.created).toHaveLength(1);
  expect(mocks.created[0]!.volume).toBeCloseTo(0.42);
  expect(mocks.created[0]!.play).toHaveBeenCalledTimes(1);
});

it('starts playback in the same tick as the rewind instead of awaiting it', async () => {
  const { playSound } = await load();
  playSound('click');
  const clip = mocks.created[0]!;
  clip.seekTo.mockReturnValueOnce(new Promise<void>(() => {}));
  playSound('click');
  expect(clip.seekTo).toHaveBeenCalledTimes(2);
  expect(clip.play).toHaveBeenCalledTimes(2);
  expect(clip.seekTo.mock.invocationCallOrder[1]).toBeLessThan(
    clip.play.mock.invocationCallOrder[1]!,
  );
});

it('preloads every clip only while sound is on', async () => {
  const { preloadSounds, setSoundPreferences } = await load();
  setSoundPreferences({ muted: true, volume: 1 });
  preloadSounds();
  expect(mocks.created).toHaveLength(0);
  setSoundPreferences({ muted: false, volume: 0.5 });
  preloadSounds();
  expect(mocks.created.map((player) => player.source)).toEqual([1, 2, 3, 4, 5]);
  expect(
    mocks.created.every((player) => player.play.mock.calls.length === 0),
  ).toBe(true);
  preloadSounds();
  expect(mocks.created).toHaveLength(5);
});
