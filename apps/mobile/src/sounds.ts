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
    existing.volume = volumes[name];
    players[name] = existing;
  }
  return existing;
}

export function playSound(name: SoundName) {
  try {
    const sound = player(name);
    void sound
      .seekTo(0)
      .then(() => sound.play())
      .catch(() => {
        /* Sound is decoration; a failed clip is skipped. */
      });
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
    default:
      return [];
  }
}

// Plays an animation's cues once; the returned function cancels any not yet heard.
export function cueAnimationSounds(animation: CerberusAnimation) {
  const timers = soundCues(animation).map(({ sound, at }) =>
    setTimeout(() => playSound(sound), at),
  );
  return () => timers.forEach(clearTimeout);
}
