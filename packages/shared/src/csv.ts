import type { Entry } from './schemas';
export function exportCsv(
  entries: readonly Pick<Entry, 'date' | 'value' | 'note'>[],
): string {
  const cell = (value: string) =>
    `"${(/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replace(/"/g, '""')}"`;
  return [
    'date,value,note',
    ...entries.map((entry) =>
      [entry.date, entry.value?.toString() ?? '', entry.note ?? '']
        .map(cell)
        .join(','),
    ),
  ].join('\r\n');
}
