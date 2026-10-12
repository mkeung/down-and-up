import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider, useApp } from './app-context';

const mocks = vi.hoisted(() => ({
  state: new Map<string, string>(),
  request: vi.fn(),
  identity: { id: '7K3M9QX2PDA4', secret: null, registered: true },
  operationId: '11111111-1111-4111-8111-111111111111',
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
    setState = async (key: string, value: string | null) => {
      if (value === null) mocks.state.delete(key);
      else mocks.state.set(key, value);
    };
    resetSync = async () => undefined;
    list = async () => [];
    subscribe = () => () => undefined;
    onEdit = () => () => undefined;
    onWriteState = () => () => undefined;
    writeState = () => ({ pending: false, failed: false });
    hasDirty = async () => false;
    uploads = async () => [];
    pushBatch = async () => [];
    applyResponse = async () => undefined;
  },
}));
vi.mock('./transport', () => ({
  apiUrl: () => 'https://example.com',
  HttpTransport: class {
    request = mocks.request;
    cleanup = async () => undefined;
  },
}));
vi.mock('./reminders', () => ({
  Reminders: class {
    rebuild = async () => undefined;
    foreground = async () => undefined;
  },
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
let app: ReturnType<typeof useApp>;
function Probe() {
  app = useApp();
  return null;
}
beforeEach(async () => {
  vi.useFakeTimers();
  mocks.state.clear();
  mocks.state.set('sync_enabled', 'true');
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
