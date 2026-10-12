import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { DataStatus } from './data-status';
import { useDataStatusIndicator } from './data-status-indicator';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
let displayed: DataStatus;
function Probe({ status }: { status: DataStatus }) {
  displayed = useDataStatusIndicator(status);
  return null;
}
async function mount(status: DataStatus) {
  await act(async () => {
    renderer = create(createElement(Probe, { status }));
  });
}
async function change(status: DataStatus) {
  await act(async () => renderer.update(createElement(Probe, { status })));
}
async function advance(milliseconds: number) {
  await act(async () => {
    vi.advanceTimersByTime(milliseconds);
  });
}
beforeEach(() => vi.useFakeTimers());
afterEach(async () => {
  await act(async () => renderer?.unmount());
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});

it.each(['local', 'cloud'] as const)(
  'keeps %s until unsaved persists for 500ms, then shows red',
  async (saved) => {
    await mount(saved);
    await change('unsaved');
    expect(displayed).toBe(saved);
    await advance(499);
    expect(displayed).toBe(saved);
    await advance(1);
    expect(displayed).toBe('unsaved');
    await advance(2000);
    expect(displayed).toBe('unsaved');
  },
);

it('skips red for a quick save and shows yellow/green immediately', async () => {
  await mount('cloud');
  await change('unsaved');
  await advance(200);
  await change('local');
  expect(displayed).toBe('local');
  await change('cloud');
  expect(displayed).toBe('cloud');
  await advance(1000);
  expect(displayed).toBe('cloud');
});

it('requires one continuous unsaved period rather than accumulating short writes', async () => {
  await mount('local');
  await change('unsaved');
  await advance(350);
  await change('local');
  await change('unsaved');
  await advance(350);
  expect(displayed).toBe('local');
  await advance(150);
  expect(displayed).toBe('unsaved');
});

it('hides red immediately after saving and delays the next unsaved period afresh', async () => {
  await mount('local');
  await change('unsaved');
  await advance(500);
  await change('cloud');
  expect(displayed).toBe('cloud');
  await change('unsaved');
  expect(displayed).toBe('cloud');
  await advance(499);
  expect(displayed).toBe('cloud');
});

it('does not restart the delay for rerenders while already unsaved', async () => {
  await mount('local');
  await change('unsaved');
  await advance(300);
  await change('unsaved');
  await advance(200);
  expect(displayed).toBe('unsaved');
});

it('starts with yellow and delays red when the first observed state is unsaved', async () => {
  await mount('unsaved');
  expect(displayed).toBe('local');
  await advance(500);
  expect(displayed).toBe('unsaved');
});
