'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeId } from '@down-up/shared';
export function LoginForm() {
  const [id, setId] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${normalizeId(id)}` },
      });
      if (!response.ok) {
        setError(
          response.status === 429
            ? 'Please wait and try again.'
            : 'ID not found',
        );
        return;
      }
      setId('');
      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('Could not connect. Try again.');
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <label htmlFor="record-id">Enter your ID</label>
      <input
        className="id-input"
        id="record-id"
        aria-label="Enter your ID"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        value={id}
        onChange={(event) => setId(event.target.value)}
        placeholder="XXXX XXXX XXXX"
        maxLength={32}
        required
      />
      <button className="primary wide" type="submit" disabled={pending}>
        {pending ? 'Opening…' : 'View'}
      </button>
      <p className="error" role="status" aria-live="polite">
        {error}
      </p>
    </form>
  );
}
