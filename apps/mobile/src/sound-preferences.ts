export const SOUND_STATE_KEY = 'ui_sound';
export type SoundPreferences = { muted: boolean; volume: number };
export const DEFAULT_SOUND_PREFERENCES: SoundPreferences = {
  muted: false,
  volume: 1,
};

export function parseSoundPreferences(saved: string | null): SoundPreferences {
  if (!saved) return DEFAULT_SOUND_PREFERENCES;
  try {
    const value: unknown = JSON.parse(saved);
    if (
      typeof value === 'object' &&
      value !== null &&
      'muted' in value &&
      typeof value.muted === 'boolean' &&
      'volume' in value &&
      typeof value.volume === 'number' &&
      Number.isFinite(value.volume) &&
      value.volume >= 0 &&
      value.volume <= 1
    )
      return { muted: value.muted, volume: value.volume };
  } catch {
    /* An unreadable saved preference must not unexpectedly make sound. */
  }
  return { ...DEFAULT_SOUND_PREFERENCES, muted: true };
}
