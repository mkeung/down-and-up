import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ActivityIndicator, Alert, AppState, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { identitySchema, normalizeId, type Identity } from '@down-up/shared';
import { newIdentity, readIdentity, writeIdentity } from './identity';
import { Repository } from './repository';
import { HttpTransport, apiUrl } from './transport';
import { SyncEngine, type SyncStatus } from './sync-engine';
import { Reminders } from './reminders';
import { dataStatus, type DataStatus } from './data-status';
import { useDataStatusIndicator } from './data-status-indicator';

type Runtime = {
  repo: Repository;
  transport: HttpTransport;
  engine: SyncEngine;
  reminders: Reminders;
};
type AppContextValue = Runtime & {
  identity: Identity | null;
  syncEnabled: boolean;
  needsConsent: boolean;
  needsIdentity: boolean;
  status: SyncStatus;
  dataStatus: DataStatus;
  indicatorDataStatus: DataStatus;
  setNotePending: (pending: boolean) => void;
  revision: number;
  blockedNotifications: boolean;
  consent: (sync: boolean) => Promise<void>;
  setSync: (sync: boolean) => Promise<void>;
  adoptId: (id: string, discard: boolean) => Promise<void>;
  startNew: () => Promise<void>;
  deleteData: (discard: boolean) => Promise<void>;
  replaceId: () => Promise<void>;
  recordingPath: (audioId: string) => Promise<string>;
};
const Context = createContext<AppContextValue | null>(null);
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error('App is starting');
  return value;
}
export function reportError(error: unknown) {
  Alert.alert(
    'Could not finish',
    error instanceof Error ? error.message : 'Please try again.',
  );
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [syncEnabled, setEnabled] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [needsIdentity, setNeedsIdentity] = useState(false);
  const [status, setStatus] = useState<SyncStatus>(
    'Saved on device, will sync',
  );
  const [blockedNotifications, setBlockedNotifications] = useState(false);
  const [revision, setRevision] = useState(0);
  const [online, setOnline] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notePending, setNotePending] = useState(false);
  const [writeState, setWriteState] = useState({
    pending: false,
    failed: false,
  });
  const [startupError, setStartupError] = useState(false);
  const identityRef = useRef<Identity | null>(null);
  const enabledRef = useRef(false);
  const onlineRef = useRef(false);
  const operations = useRef(new AbortController());
  const saveIdentity = useCallback(async (next: Identity | null) => {
    await writeIdentity(next);
    identityRef.current = next;
    setIdentity(next);
  }, []);
  useEffect(() => {
    let alive = true;
    let initialized: Runtime | null = null;
    let disposeRepo: (() => void) | undefined;
    let disposeEdit: (() => void) | undefined;
    let disposeNet: (() => void) | undefined;
    let disposeApp: (() => void) | undefined;
    void (async () => {
      const repo = new Repository(await SQLite.openDatabaseAsync('down-up.db'));
      await repo.initialize();
      let stored = await readIdentity();
      const transition = await repo.state('identity_transition');
      if (transition)
        await repo.resetSync(
          transition === 'discard',
          transition === 'replace',
        );
      const cursor = await repo.state('cursor');
      const rows = await repo.list();
      if (!stored && cursor !== null) setNeedsIdentity(true);
      else if (!stored && (await repo.state('sync_enabled')) !== 'false') {
        stored = newIdentity();
        await saveIdentity(stored);
      }
      if (stored && rows.length === 0) {
        await repo.resetSync(false);
        if (stored.secret) {
          stored = { ...stored, registered: false };
          await saveIdentity(stored);
        }
      }
      identityRef.current = stored;
      setIdentity(stored);
      const consent = await repo.state('sync_enabled');
      enabledRef.current = consent === 'true';
      setEnabled(enabledRef.current);
      setNeedsConsent(consent === null);
      const transport = new HttpTransport(repo);
      const reminders = new Reminders(
        repo,
        () => enabledRef.current,
        setBlockedNotifications,
      );
      const engine = new SyncEngine(
        repo,
        transport,
        () => identityRef.current,
        saveIdentity,
        setStatus,
        () => setNeedsIdentity(true),
        () => reminders.rebuild(true),
        async () => {
          const replacement = newIdentity();
          await repo.setState('identity_transition', 'merge');
          await saveIdentity(replacement);
          await repo.resetSync(false);
          return replacement;
        },
      );
      initialized = { repo, transport, engine, reminders };
      if (!alive) {
        await engine.stop();
        return;
      }
      disposeRepo = repo.subscribe(() => setRevision((value) => value + 1));
      disposeEdit = repo.onEdit(() => {
        setStatus('Saved on device, will sync');
        engine.schedule();
        if (!enabledRef.current)
          void transport.cleanup(true).catch(reportError);
        void reminders.rebuild().catch(reportError);
      });
      disposeNet = NetInfo.addEventListener((state) => {
        onlineRef.current =
          state.isConnected === true && state.isInternetReachable !== false;
        setOnline(onlineRef.current);
        engine.configure(
          enabledRef.current && !!apiUrl(),
          onlineRef.current,
          AppState.currentState === 'active',
        );
      });
      const appSubscription = AppState.addEventListener('change', (state) => {
        engine.configure(
          enabledRef.current && !!apiUrl(),
          onlineRef.current,
          state === 'active',
        );
        if (state === 'active') void reminders.foreground().catch(reportError);
      });
      disposeApp = () => appSubscription.remove();
      await reminders.rebuild();
      await transport.cleanup(consent === 'false');
      setRuntime(initialized);
    })().catch(() => {
      if (alive) setStartupError(true);
    });
    return () => {
      alive = false;
      disposeRepo?.();
      disposeEdit?.();
      disposeNet?.();
      disposeApp?.();
      void initialized?.engine.stop();
      operations.current.abort();
    };
  }, [saveIdentity]);
  useEffect(() => {
    if (!runtime) return;
    return runtime.repo.onWriteState(() =>
      setWriteState(runtime.repo.writeState()),
    );
  }, [runtime]);
  useEffect(() => {
    if (!runtime) return;
    let active = true;
    void runtime.repo
      .hasDirty()
      .then((value) => {
        if (active) setDirty(value);
      })
      .catch(reportError);
    return () => {
      active = false;
    };
  }, [runtime, revision]);
  useEffect(() => {
    if (!runtime) return;
    let last = `${new Date().getDate()}:${new Date().getTimezoneOffset()}`;
    const timer = setInterval(() => {
      const now = `${new Date().getDate()}:${new Date().getTimezoneOffset()}`;
      if (now !== last) {
        last = now;
        void runtime.reminders.rebuild().catch(reportError);
      }
    }, 30_000);
    return () => clearInterval(timer);
  }, [runtime]);

  const currentDataStatus = dataStatus({
    notePending,
    writePending: writeState.pending,
    writeFailed: writeState.failed,
    dirty,
    syncEnabled,
    serverConfigured: !!apiUrl(),
    needsIdentity,
    online,
    syncStatus: status,
  });
  const indicatorDataStatus = useDataStatusIndicator(currentDataStatus);

  if (!runtime)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {startupError ? (
          <Text>Could not open saved data. Restart the app to try again.</Text>
        ) : (
          <ActivityIndicator accessibilityLabel="Opening saved data" />
        )}
      </View>
    );
  const { repo, engine, transport, reminders } = runtime;
  const resumeSync = () =>
    engine.configure(
      enabledRef.current && !!apiUrl(),
      onlineRef.current,
      AppState.currentState === 'active',
    );
  const stop = async () => {
    operations.current.abort();
    operations.current = new AbortController();
    await engine.stop();
  };
  const enable = async (value: boolean) => {
    enabledRef.current = value;
    setEnabled(value);
    await repo.setState('sync_enabled', String(value));
    engine.configure(
      value && !!apiUrl(),
      onlineRef.current,
      AppState.currentState === 'active',
    );
    await reminders.rebuild(true);
    if (!value) await runtime.transport.cleanup(true);
  };
  const transition = async (
    next: Identity | null,
    discard: boolean,
    preserveUploads = false,
  ) => {
    await stop();
    await repo.setState(
      'identity_transition',
      discard ? 'discard' : preserveUploads ? 'replace' : 'merge',
    );
    await saveIdentity(next);
    await repo.resetSync(discard, preserveUploads);
    if (discard)
      await Promise.all([
        FileSystem.deleteAsync(`${FileSystem.documentDirectory}recordings`, {
          idempotent: true,
        }),
        FileSystem.deleteAsync(`${FileSystem.cacheDirectory}down-and-up.csv`, {
          idempotent: true,
        }),
        FileSystem.deleteAsync(
          `${FileSystem.cacheDirectory}down-and-up-recordings.zip`,
          { idempotent: true },
        ),
      ]);
    setNeedsIdentity(false);
    setStatus('Saved on device, will sync');
  };
  const recordingPath = async (audioId: string) => {
    const local = await repo.audio(audioId);
    if (
      local?.local_path &&
      (await FileSystem.getInfoAsync(local.local_path)).exists
    )
      return local.local_path;
    if (!enabledRef.current || !identityRef.current)
      throw new Error(
        'This recording is not saved on this phone. Turn on sync to download it.',
      );
    return transport.download(
      audioId,
      identityRef.current,
      operations.current.signal,
    );
  };
  const cacheRecordings = async () => {
    for (const row of await repo.list())
      if (row.audioId) await recordingPath(row.audioId);
  };
  const value: AppContextValue = {
    ...runtime,
    identity,
    syncEnabled,
    needsConsent,
    needsIdentity,
    status,
    dataStatus: currentDataStatus,
    indicatorDataStatus,
    setNotePending,
    revision,
    blockedNotifications,
    async consent(sync) {
      await repo.setState('sync_enabled', String(sync));
      setNeedsConsent(false);
      await enable(sync);
    },
    async setSync(sync) {
      if (!sync) {
        enabledRef.current = false;
        await stop();
        await enable(false);
      } else {
        if (!identityRef.current) await transition(newIdentity(), false);
        await enable(true);
      }
    },
    async startNew() {
      await transition(newIdentity(), false);
      await enable(true);
    },
    async adoptId(id, discard) {
      const normalized = normalizeId(id);
      identitySchema.shape.id.parse(normalized);
      const previousEnabled = enabledRef.current;
      await stop();
      enabledRef.current = true;
      setEnabled(true);
      await repo.setState('sync_enabled', 'true');
      try {
        const next: Identity = {
          id: normalized,
          secret: null,
          registered: true,
        };
        await transport.request(
          '/api/ids/verify',
          next,
          'POST',
          {},
          operations.current.signal,
        );
        if (!discard) await cacheRecordings();
        await transition(next, discard);
        await enable(true);
      } catch (error) {
        await enable(previousEnabled);
        throw error;
      }
    },
    async deleteData(discard) {
      if (!identityRef.current || !enabledRef.current)
        throw new Error('Turn on sync to delete server data');
      await stop();
      try {
        await transport.request(
          '/api/data',
          identityRef.current,
          'DELETE',
          undefined,
          operations.current.signal,
        );
      } catch (error) {
        resumeSync();
        throw error;
      }
      enabledRef.current = false;
      await enable(false);
      await transition(discard ? newIdentity() : null, discard);
      if (discard) await enable(true);
    },
    async replaceId() {
      if (!identityRef.current || !enabledRef.current)
        throw new Error('Turn on sync first');
      await stop();
      let next: Identity;
      try {
        const operationId =
          (await repo.state('replace_operation')) ?? Crypto.randomUUID();
        await repo.setState('replace_operation', operationId);
        const response = await transport.request(
          '/api/ids/replace',
          identityRef.current,
          'POST',
          { operationId },
          operations.current.signal,
        );
        next = identitySchema.parse(response);
      } catch (error) {
        resumeSync();
        throw error;
      }
      await transition(next, false, true);
      await repo.setState('replace_operation', null);
      await enable(true);
    },
    recordingPath,
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
