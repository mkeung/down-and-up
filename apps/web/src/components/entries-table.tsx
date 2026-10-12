'use client';
import { useState } from 'react';
import { z } from 'zod';
import { serverEntrySchema, type ServerEntry } from '@down-up/shared';
const pageSchema = z.object({
  entries: z.array(serverEntrySchema),
  hasMore: z.boolean(),
});
export function EntriesTable({
  from,
  to,
  initialRows,
  initialHasMore,
}: {
  from: string;
  to: string;
  initialRows: ServerEntry[];
  initialHasMore: boolean;
}) {
  const [rows, setRows] = useState(initialRows);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const load = async (next: number) => {
    setPending(true);
    setError('');
    try {
      const response = await fetch(
        `/api/entries?from=${from}&to=${to}&page=${next}`,
      );
      if (!response.ok) throw new Error();
      const data = pageSchema.parse(await response.json());
      setRows(data.entries);
      setHasMore(data.hasMore);
      setPage(next);
    } catch {
      setError('Could not load entries. Try again.');
    } finally {
      setPending(false);
    }
  };
  return (
    <section className="table-card">
      <h2>Entries</h2>
      <div className="table-scroll">
        <table>
          <caption className="screen-reader">
            Daily entries, newest first
          </caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Value</th>
              <th scope="col">Note</th>
              <th scope="col">Recording</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <tr key={entry.date}>
                <td>{entry.date}</td>
                <td>{entry.value ?? '—'}</td>
                <td className="note">{entry.note ?? '—'}</td>
                <td>
                  {entry.audioId ? (
                    <audio
                      aria-label={`Recording for ${entry.date}`}
                      controls
                      preload="none"
                      src={`/api/audio/${entry.audioId}`}
                    />
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="empty">Nothing recorded yet</p>}
      <p role="status">{error}</p>
      <div className="pagination">
        <button
          disabled={pending || page === 1}
          onClick={() => {
            void load(page - 1);
          }}
        >
          Previous
        </button>
        <span className="small muted">Page {page}</span>
        <button
          disabled={pending || !hasMore}
          onClick={() => {
            void load(page + 1);
          }}
        >
          Next
        </button>
      </div>
    </section>
  );
}
