'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function SignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      <button
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError('');
          try {
            const response = await fetch('/api/session', { method: 'DELETE' });
            if (!response.ok) throw new Error();
            router.replace('/');
            router.refresh();
          } catch {
            setError('Could not sign out. Try again.');
          } finally {
            setPending(false);
          }
        }}
      >
        Sign out
      </button>
      {error && <span role="status">{error}</span>}
    </>
  );
}
