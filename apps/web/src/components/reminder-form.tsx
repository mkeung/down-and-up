'use client';
import { useRef, useState } from 'react';
import { settingsSchema, type Settings } from '@down-up/shared';
export function ReminderForm({ initial }: { initial: Settings }) {
  const [settings, setSettings] = useState(initial);
  const [status, setStatus] = useState('');
  const tail = useRef<Promise<void>>(Promise.resolve());
  const version = useRef(0);
  const change = (next: Settings) => {
    setSettings(next);
    setStatus('Saving…');
    const current = ++version.current;
    tail.current = tail.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const response = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settingsSchema.parse(next)),
          });
          if (!response.ok) throw new Error();
          if (version.current === current) setStatus('Saved');
        } catch {
          if (version.current === current)
            setStatus('Could not save. Try again.');
        }
      });
  };
  return (
    <div>
      <div className="switch-row">
        <label htmlFor="enabled">Daily reminder</label>
        <input
          id="enabled"
          aria-label="Daily reminder"
          type="checkbox"
          role="switch"
          checked={settings.reminderEnabled}
          onChange={(event) =>
            change({ ...settings, reminderEnabled: event.target.checked })
          }
        />
      </div>
      <label htmlFor="time">Time</label>
      <input
        id="time"
        aria-label="Reminder time"
        type="time"
        required
        value={settings.reminderTime}
        disabled={!settings.reminderEnabled}
        onChange={(event) => {
          if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(event.target.value))
            change({ ...settings, reminderTime: event.target.value });
        }}
      />
      <p className="saved" role="status" aria-live="polite">
        {status}
      </p>
      {status.startsWith('Could not') && (
        <button onClick={() => change(settings)}>Retry</button>
      )}
    </div>
  );
}
