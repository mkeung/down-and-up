import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { CerberusProvider, useCerberus } from './cerberus-context';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
let cerberus: ReturnType<typeof useCerberus>;
function Probe() {
  cerberus = useCerberus();
  return null;
}
afterEach(async () => {
  await act(async () => renderer?.unmount());
  vi.restoreAllMocks();
});

it.each([
  [0, 'food-can'],
  [0.499, 'food-can'],
  [0.5, 'backflip'],
  [0.999, 'backflip'],
])(
  'chooses a note submission animation with equal probability (%s)',
  async (random, animation) => {
    vi.spyOn(Math, 'random').mockReturnValue(random);
    await act(async () => {
      renderer = create(
        createElement(CerberusProvider, null, createElement(Probe)),
      );
    });
    expect(cerberus.request).toEqual({ sequence: 0, animation: null });
    await act(async () => cerberus.playNoteSubmit());
    expect(cerberus.request).toEqual({ sequence: 1, animation });
    await act(async () => cerberus.playNoteSubmit());
    expect(cerberus.request).toEqual({ sequence: 2, animation });
    await act(async () => cerberus.playReaction(7));
    expect(cerberus.request).toEqual({ sequence: 3, animation: 'reaction-07' });
  },
);
