import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import click from '../assets/sounds/click.wav';
import pomBark from '../assets/sounds/pom-bark.wav';
import dogBark from '../assets/sounds/dog-bark.wav';
import meowA from '../assets/sounds/meow-a.wav';
import meowB from '../assets/sounds/meow-b.wav';
import type { CerberusAnimation } from './cerberus-motion';
import type { SoundPreferences } from './sound-preferences';

const sources = { click, pomBark, dogBark, meowA, meowB };
export type SoundName = keyof typeof sources;
const volumes: Record<SoundName, number> = {
  click: 0.5,
  pomBark: 0.7,
  dogBark: 0.7,
  meowA: 0.7,
  meowB: 0.7,
};

const players: Partial<Record<SoundName, AudioPlayer>> = {};
let configured = false;
let preferences: SoundPreferences | null = null;
const pendingCues = new Set<ReturnType<typeof setTimeout>>();

const masterVolume = () =>
  preferences && !preferences.muted ? preferences.volume : 0;

export function setSoundPreferences(next: SoundPreferences | null) {
  preferences = next;
  const volume = masterVolume();
  if (volume === 0) {
    pendingCues.forEach(clearTimeout);
    pendingCues.clear();
  }
  for (const name of Object.keys(players) as SoundName[]) {
    try {
      const sound = players[name]!;
      sound.volume = volumes[name] * volume;
      if (volume === 0) sound.pause();
    } catch {
      /* A missing player must not prevent the preference from applying. */
    }
  }
}

// Short effects follow the phone's silent mode and never pause other audio.
function player(name: SoundName) {
  if (!configured) {
    configured = true;
    void setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
    }).catch(() => {
      /* Defaults still play effects. */
    });
  }
  let existing = players[name];
  if (!existing) {
    existing = createAudioPlayer(sources[name]);
    existing.volume = volumes[name] * masterVolume();
    players[name] = existing;
  }
  return existing;
}

// Loads every clip ahead of the first tap so it plays without a decode delay.
export function preloadSounds() {
  if (masterVolume() === 0) return;
  for (const name of Object.keys(sources) as SoundName[]) {
    try {
      player(name);
    } catch {
      /* A clip that cannot load is created again when played. */
    }
  }
}

export function playSound(name: SoundName) {
  if (masterVolume() === 0) return;
  try {
    const sound = player(name);
    // Rewind and play in the same tick; the native player applies the seek
    // before resuming, so a repeat tap restarts without waiting a round trip.
    void sound.seekTo(0).catch(() => {
      /* Sound is decoration; a failed rewind still plays from where it is. */
    });
    sound.play();
  } catch {
    /* Sound is decoration; a failed clip is skipped. */
  }
}

const pick = <T>(choices: readonly T[]) =>
  choices[Math.floor(Math.random() * choices.length)]!;

// Offsets line up with the key frames in assets/cerberus/timings.json.
export function soundCues(
  animation: CerberusAnimation,
): { sound: SoundName; at: number }[] {
  switch (animation) {
    case 'tennis-ball':
      return [
        { sound: 'pomBark', at: 450 },
        { sound: 'dogBark', at: 1050 },
      ];
    case 'yarn-ball':
      return [{ sound: pick(['meowA', 'meowB'] as const), at: 450 }];
    case 'food-can':
      return [
        { sound: 'dogBark', at: 500 },
        { sound: 'pomBark', at: 920 },
        { sound: pick(['meowA', 'meowB'] as const), at: 1360 },
      ];
    case 'backflip':
      return [
        { sound: 'dogBark', at: 0 },
        { sound: pick(['meowA', 'meowB'] as const), at: 1140 },
      ];
    default:
      return [];
  }
}

// Plays an animation's cues once; the returned function cancels any not yet heard.
export function cueAnimationSounds(animation: CerberusAnimation) {
  if (masterVolume() === 0) return () => {};
  const timers = soundCues(animation).map(({ sound, at }) => {
    const timer = setTimeout(() => {
      pendingCues.delete(timer);
      playSound(sound);
    }, at);
    pendingCues.add(timer);
    return timer;
  });
  return () =>
    timers.forEach((timer) => {
      clearTimeout(timer);
      pendingCues.delete(timer);
    });
}
