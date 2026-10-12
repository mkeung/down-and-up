import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { emptyEntry, todayLocal, type LocalEntry } from '@down-up/shared';
import { SelectedDateProvider, useSelectedEntry } from './selected-date';

const mocks = vi.hoisted(() => ({
  repo: { get: vi.fn(), setField: vi.fn() },
  revision: 0,
  reportError: vi.fn(),
}));
vi.mock('react-native', () => ({
  AppState: { addEventListener: () => ({ remove() {} }) },
}));
vi.mock('./app-context', () => ({
  useAppRuntime: () => ({ repo: mocks.repo }),
  useRevision: () => mocks.revision,
  reportError: mocks.reportError,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
let selected: ReturnType<typeof useSelectedEntry>;
let other: ReturnType<typeof useSelectedEntry>;
function Probe() {
  selected = useSelectedEntry();
  return null;
}
function OtherProbe() {
  other = useSelectedEntry();
  return null;
}
const tree = () =>
  createElement(
    SelectedDateProvider,
    null,
    createElement(Probe),
    createElement(OtherProbe),
  );
const stored = (value: number | null): LocalEntry => ({
  ...emptyEntry(todayLocal()),
  value,
  dirtyFields: { value: false, note: false, audio: false },
});
function later<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function mount() {
  await act(async () => {
    renderer = create(tree());
  });
}
beforeEach(() => {
  mocks.revision = 0;
  mocks.repo.get.mockReset().mockResolvedValue(stored(3));
  mocks.repo.setField.mockReset();
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

it('shares one read of the selected day between consumers', async () => {
  await mount();
  expect(mocks.repo.get).toHaveBeenCalledExactlyOnceWith(todayLocal());
  expect(selected.value).toBe(3);
  expect(other.entry).toBe(selected.entry);
});

it('highlights a tapped value before its write finishes and keeps it through the reload', async () => {
  await mount();
  const write = later<boolean>();
  mocks.repo.setField.mockReturnValueOnce(write.promise);
  let saved!: Promise<boolean>;
  await act(async () => {
    saved = selected.chooseValue(8);
  });
  expect(mocks.repo.setField).toHaveBeenCalledWith(todayLocal(), 'value', 8);
  expect(selected.value).toBe(8);
  expect(other.value).toBe(8);
  // The write lands; the stored value updates on the next read.
  mocks.repo.get.mockResolvedValue(stored(8));
  await act(async () => write.resolve(true));
  await expect(saved).resolves.toBe(true);
  expect(selected.value).toBe(8);
  mocks.revision++;
  await act(async () => renderer.update(tree()));
  expect(selected.value).toBe(8);
  expect(selected.entry?.value).toBe(8);
  // Once the fresh read lands, later stored changes show through.
  mocks.repo.get.mockResolvedValue(stored(5));
  mocks.revision++;
  await act(async () => renderer.update(tree()));
  expect(selected.value).toBe(5);
});

it('reverts the highlight when the write fails', async () => {
  await mount();
  const write = later<boolean>();
  mocks.repo.setField.mockReturnValueOnce(write.promise);
  let saved!: Promise<boolean>;
  await act(async () => {
    saved = selected.chooseValue(9);
  });
  expect(selected.value).toBe(9);
  const failure = expect(saved).rejects.toThrow('Disk full');
  await act(async () => write.reject(new Error('Disk full')));
  await failure;
  expect(selected.value).toBe(3);
});

it('keeps the newest tap when an older write finishes or fails later', async () => {
  await mount();
  const first = later<boolean>();
  const second = later<boolean>();
  mocks.repo.setField
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  let older!: Promise<boolean>;
  await act(async () => {
    older = selected.chooseValue(1);
    void selected.chooseValue(10);
  });
  expect(selected.value).toBe(10);
  const failure = expect(older).rejects.toThrow('Busy');
  await act(async () => first.reject(new Error('Busy')));
  await failure;
  expect(selected.value).toBe(10);
  await act(async () => second.resolve(true));
  expect(selected.value).toBe(10);
});
