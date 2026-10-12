import { createElement } from 'react';
import { TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteEditor } from './note-editor';
import { PixelFontContext } from './retro';

const mocks = vi.hoisted(() => ({
  repo: { setField: vi.fn() },
  reportError: vi.fn(),
  setNotePending: vi.fn(),
}));
vi.mock('react-native', () => ({
  TextInput: 'TextInput',
  Text: 'Text',
  Image: 'Image',
  View: 'View',
  AppState: { addEventListener: () => ({ remove() {} }) },
}));
vi.mock('./app-context', () => ({
  useApp: () => ({ repo: mocks.repo, setNotePending: mocks.setNotePending }),
  reportError: mocks.reportError,
}));
vi.mock('./theme', () => ({ useTheme: () => ({}) }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
const date = '2026-01-01';
const input = () => renderer.root.findByType(TextInput);
async function mount(note: string | null = 'saved') {
  await act(async () => {
    renderer = create(createElement(NoteEditor, { date, note }));
  });
}
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.useFakeTimers();
  mocks.repo.setField.mockReset().mockResolvedValue(true);
  mocks.reportError.mockReset();
  mocks.setNotePending.mockReset();
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  vi.useRealTimers();
});

it('types notes in the pixel font once it has loaded', async () => {
  await act(async () => {
    renderer = create(
      createElement(
        PixelFontContext.Provider,
        { value: true },
        createElement(NoteEditor, { date, note: null }),
      ),
    );
  });
  expect(input().props.style.fontFamily).toBe('PixelifySans');
});

describe('note autosave', () => {
  it('retains a failed blur save and retries the same draft on the next blur', async () => {
    const write = deferred();
    mocks.repo.setField.mockReturnValueOnce(write.promise);
    await mount();
    await act(async () => input().props.onFocus());
    await act(async () => input().props.onChangeText('unsaved draft'));
    await act(async () => input().props.onBlur());
    expect(input().props.value).toBe('unsaved draft');
    const failure = new Error('Disk full');
    await act(async () => write.reject(failure));
    expect(input().props.value).toBe('unsaved draft');
    expect(mocks.reportError).toHaveBeenCalledWith(failure);
    await act(async () => input().props.onFocus());
    await act(async () => input().props.onBlur());
    expect(mocks.repo.setField).toHaveBeenNthCalledWith(
      2,
      date,
      'note',
      'unsaved draft',
    );
  });

  it('does not clear a newer draft when an older write succeeds', async () => {
    const first = deferred();
    const second = deferred();
    mocks.repo.setField
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    await mount();
    await act(async () => input().props.onFocus());
    await act(async () => input().props.onChangeText('first'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await act(async () => input().props.onChangeText('second'));
    await act(async () => first.resolve());
    await act(async () => {
      renderer.update(createElement(NoteEditor, { date, note: 'first' }));
      input().props.onBlur();
    });
    expect(input().props.value).toBe('second');
    expect(mocks.repo.setField).toHaveBeenLastCalledWith(
      date,
      'note',
      'second',
    );
    await act(async () => second.resolve());
  });

  it('does not submit the same in-flight draft twice', async () => {
    const write = deferred();
    mocks.repo.setField.mockReturnValueOnce(write.promise);
    await mount();
    await act(async () => input().props.onChangeText('draft'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await act(async () => input().props.onBlur());
    expect(mocks.repo.setField).toHaveBeenCalledTimes(1);
    await act(async () => write.resolve());
  });

  it('debounces edits and stores a cleared note as null', async () => {
    await mount();
    await act(async () => input().props.onFocus());
    await act(async () => input().props.onChangeText('draft'));
    expect(mocks.setNotePending).toHaveBeenLastCalledWith(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    await act(async () => input().props.onChangeText(''));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(mocks.repo.setField).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mocks.repo.setField).toHaveBeenCalledWith(date, 'note', null);
    expect(mocks.setNotePending).toHaveBeenLastCalledWith(false);
  });

  it('flushes the original day when its editor unmounts', async () => {
    await mount();
    await act(async () => input().props.onChangeText('original day'));
    await act(async () => renderer.unmount());
    expect(mocks.repo.setField).toHaveBeenCalledWith(
      date,
      'note',
      'original day',
    );
  });
});
