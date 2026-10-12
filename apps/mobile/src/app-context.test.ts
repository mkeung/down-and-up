import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider, useApp, useAppRuntime } from './app-context';

const mocks = vi.hoisted(() => ({
  state: new Map<string, string>(),
  request: vi.fn(),
  identity: { id: '7K3M9QX2PDA4', secret: null, registered: true },
  operationId: '11111111-1111-4111-8111-111111111111',
  rebuild: vi.fn(),
  cleanup: vi.fn(),
  hasEntries: vi.fn(),
  states: vi.fn(),
  logged: vi.fn(),
  applyResponse: vi.fn(),
  edit: null as
    | ((edit: { date: string; field: 'value' | 'note' | 'audio' }) => void)
    | null,
  writeState: { pending: false, failed: false },
  writeListener: null as (() => void) | null,
}));
vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  ActivityIndicator: 'ActivityIndicator',
  Alert: { alert: vi.fn() },
  AppState: {
    currentState: 'active',
    addEventListener: () => ({ remove() {} }),
  },
}));
vi.mock('@react-native-community/netinfo', () => ({
  default: {
    addEventListener: (
      listener: (state: {
        isConnected: boolean;
        isInternetReachable: boolean;
      }) => void,
    ) => {
      listener({ isConnected: true, isInternetReachable: true });
      return () => undefined;
    },
  },
}));
vi.mock('expo-sqlite', () => ({ openDatabaseAsync: async () => ({}) }));
vi.mock('expo-crypto', () => ({ randomUUID: () => mocks.operationId }));
vi.mock('expo-file-system/legacy', () => ({ deleteAsync: vi.fn() }));
vi.mock('./identity', () => ({
  readIdentity: async () => mocks.identity,
  writeIdentity: vi.fn(),
  newIdentity: () => mocks.identity,
}));
vi.mock('./repository', () => ({
  Repository: class {
    initialize = async () => undefined;
    state = async (key: string) => mocks.state.get(key) ?? null;
    states = mocks.states;
    setState = async (key: string, value: string | null) => {
      if (value === null) mocks.state.delete(key);
      else mocks.state.set(key, value);
    };
    resetSync = async () => undefined;
    list = async () => [];
    hasEntries = mocks.hasEntries;
    subscribe = () => () => undefined;
    onEdit = (
      listener: (edit: {
        date: string;
        field: 'value' | 'note' | 'audio';
      }) => void,
    ) => {
      mocks.edit = listener;
      return () => undefined;
    };
    onWriteState = (listener: () => void) => {
      mocks.writeListener = listener;
      return () => undefined;
    };
    writeState = () => ({ ...mocks.writeState });
    hasDirty = async () => false;
    uploads = async () => [];
    pushBatch = async () => [];
    applyResponse = mocks.applyResponse;
  },
}));
vi.mock('./transport', () => ({
  apiUrl: () => 'https://example.com',
  HttpTransport: class {
    request = mocks.request;
    cleanup = mocks.cleanup;
  },
}));
vi.mock('./reminders', () => ({
  Reminders: class {
    rebuild = mocks.rebuild;
    logged = mocks.logged;
    affects = (date: string) => date >= '2026-10-12';
    foreground = async () => undefined;
  },
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
let app: ReturnType<typeof useApp>;
let runtime: ReturnType<typeof useAppRuntime>;
function Probe() {
  app = useApp();
  runtime = useAppRuntime();
  return null;
}
beforeEach(async () => {
  vi.useFakeTimers();
  mocks.state.clear();
  mocks.state.set('sync_enabled', 'true');
  mocks.rebuild.mockReset().mockResolvedValue(undefined);
  mocks.logged.mockReset().mockResolvedValue(undefined);
  mocks.applyResponse
    .mockReset()
    .mockResolvedValue({ dates: [], settingsChanged: false });
  mocks.writeState = { pending: false, failed: false };
  mocks.cleanup.mockReset().mockResolvedValue(undefined);
  mocks.hasEntries.mockReset().mockResolvedValue(false);
  mocks.states
    .mockReset()
    .mockImplementation(async (keys: string[]) =>
      Object.fromEntries(
        keys.map((key) => [key, mocks.state.get(key) ?? null]),
      ),
    );
  mocks.request.mockReset().mockResolvedValue({
    applied: [],
    changes: [],
    cursor: '0',
    hasMore: false,
    missingAudio: [],
    settings: { reminderEnabled: false, reminderTime: '20:00' },
  });
  await act(async () => {
    renderer = create(createElement(AppProvider, null, createElement(Probe)));
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  vi.useRealTimers();
});

it('keeps the real status immediate while sharing the icon delay across tab consumers', async () => {
  await act(async () => app.engine.sync());
  expect(app.dataStatus).toBe('cloud');
  await act(async () => app.setNotePending(true));
  expect(app.dataStatus).toBe('unsaved');
  expect(app.indicatorDataStatus).toBe('cloud');
  await act(async () => {
    vi.advanceTimersByTime(400);
  });
  // Replace the screen consumer without remounting the app provider.
  await act(async () =>
    renderer.update(
      createElement(
        AppProvider,
        null,
        createElement(Probe, { key: 'other-tab' }),
      ),
    ),
  );
  expect(app.indicatorDataStatus).toBe('cloud');
  await act(async () => {
    vi.advanceTimersByTime(100);
  });
  expect(app.indicatorDataStatus).toBe('unsaved');
  await act(async () => app.setNotePending(false));
  expect(app.dataStatus).toBe('cloud');
  expect(app.indicatorDataStatus).toBe('cloud');
});

it('opens local data without waiting for notification or recording housekeeping', async () => {
  await act(async () => renderer.unmount());
  mocks.hasEntries.mockResolvedValue(true);
  mocks.rebuild.mockReturnValue(new Promise(() => {}));
  mocks.cleanup.mockReturnValue(new Promise(() => {}));
  let opened = false;
  function Opened() {
    useApp();
    opened = true;
    return null;
  }
  await act(async () => {
    renderer = create(createElement(AppProvider, null, createElement(Opened)));
  });
  expect(opened).toBe(true);
  expect(mocks.hasEntries).toHaveBeenCalled();
  expect(mocks.rebuild).toHaveBeenCalled();
  expect(mocks.cleanup).toHaveBeenCalled();
});

describe('failed identity operations', () => {
  it.each(['delete', 'replace'] as const)(
    'resumes sync after a failed %s request',
    async (operation) => {
      const failure = new Error('Network unavailable');
      mocks.request.mockRejectedValueOnce(failure);
      await act(async () => {
        await expect(
          operation === 'delete' ? app.deleteData(false) : app.replaceId(),
        ).rejects.toThrow(failure);
      });
      expect(app.syncEnabled).toBe(true);
      expect(app.identity).toEqual(mocks.identity);
      await act(async () => app.engine.sync());
      expect(mocks.request).toHaveBeenLastCalledWith(
        '/api/sync',
        mocks.identity,
        'POST',
        { changes: [], cursor: null },
        expect.any(AbortSignal),
      );
    },
  );

  it('keeps the replacement operation ID for a retry after a lost response', async () => {
    mocks.request.mockRejectedValue(new Error('Response lost'));
    await act(async () => {
      await expect(app.replaceId()).rejects.toThrow('Response lost');
      await expect(app.replaceId()).rejects.toThrow('Response lost');
    });
    expect(mocks.state.get('replace_operation')).toBe(mocks.operationId);
    expect(mocks.request.mock.calls.map((call) => call[3])).toEqual([
      { operationId: mocks.operationId },
      { operationId: mocks.operationId },
    ]);
  });

  it.each(['delete', 'replace'] as const)(
    'keeps sync off if disabled while a %s request is failing',
    async (operation) => {
      let reject!: (error: Error) => void;
      mocks.request.mockImplementationOnce(
        () =>
          new Promise((_yes, no) => {
            reject = no;
          }),
      );
      let pending!: Promise<void>;
      await act(async () => {
        pending =
          operation === 'delete' ? app.deleteData(false) : app.replaceId();
      });
      await act(async () => app.setSync(false));
      await act(async () => {
        const failure = expect(pending).rejects.toThrow('Aborted');
        reject(new Error('Aborted'));
        await failure;
      });
      expect(app.syncEnabled).toBe(false);
      await act(async () => app.engine.sync());
      expect(mocks.request).toHaveBeenCalledTimes(1);
    },
  );

  it('does not resume sync after a successful delete that keeps local data', async () => {
    mocks.request.mockResolvedValueOnce(null);
    await act(async () => app.deleteData(false));
    expect(app.syncEnabled).toBe(false);
    expect(app.identity).toBeNull();
    await act(async () => app.engine.sync());
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
});

describe('responsiveness', () => {
  it('reads startup sync state in one query', async () => {
    expect(mocks.states).toHaveBeenCalledExactlyOnceWith([
      'identity_transition',
      'cursor',
      'sync_enabled',
    ]);
  });

  it('keeps the runtime and its actions stable across status changes', async () => {
    const first = runtime;
    const firstApp = app;
    await act(async () => app.setNotePending(true));
    expect(app).not.toBe(firstApp);
    expect(runtime).toBe(first);
    expect(app.setSync).toBe(first.setSync);
    const settled = app;
    await act(async () => mocks.writeListener!());
    // An unchanged write state does not publish a new context value.
    expect(app).toBe(settled);
  });

  it("updates reminders only for value edits, cancelling just that day's", async () => {
    mocks.rebuild.mockClear();
    await act(async () => mocks.edit!({ date: '2026-10-12', field: 'note' }));
    await act(async () => mocks.edit!({ date: '2026-10-12', field: 'audio' }));
    expect(mocks.logged).not.toHaveBeenCalled();
    await act(async () => mocks.edit!({ date: '2026-10-12', field: 'value' }));
    expect(mocks.logged).toHaveBeenCalledExactlyOnceWith('2026-10-12');
    expect(mocks.rebuild).not.toHaveBeenCalled();
  });

  it('rebuilds reminders after sync only for new settings or pulled days from today on', async () => {
    mocks.rebuild.mockClear();
    mocks.applyResponse.mockResolvedValueOnce({
      dates: ['2026-10-01'],
      settingsChanged: false,
    });
    await act(async () => app.engine.sync());
    expect(mocks.rebuild).not.toHaveBeenCalled();
    mocks.applyResponse.mockResolvedValueOnce({
      dates: ['2026-10-12'],
      settingsChanged: false,
    });
    await act(async () => app.engine.sync());
    expect(mocks.rebuild).toHaveBeenCalledExactlyOnceWith(true);
    mocks.applyResponse.mockResolvedValueOnce({
      dates: [],
      settingsChanged: true,
    });
    await act(async () => app.engine.sync());
    expect(mocks.rebuild).toHaveBeenCalledTimes(2);
  });
});
