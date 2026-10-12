import { expect, it } from 'vitest';
import { keypadLayout } from './entry-layout';

it.each([1, 1.5, 2, 3.2])(
  'preserves four separate rows and full targets at font scale %s',
  (scale) => {
    const layout = keypadLayout(scale);
    expect(layout.keyHeight).toBeGreaterThanOrEqual(64);
    expect(layout.keyHeight).toBeGreaterThanOrEqual(44 * scale + 20);
    expect(layout.height - layout.rowsHeight - layout.keyHeight).toBe(12);
  },
);
