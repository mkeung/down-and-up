'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main>
      <h1>Could not load your record.</h1>
      <p>Please try again in a moment.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
