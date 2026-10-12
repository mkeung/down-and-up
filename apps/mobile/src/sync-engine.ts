import {
  syncResponseSchema,
  type Identity,
  type SyncResponse,
} from '@down-up/shared';
import type { AppliedSync, AudioFile, Repository } from './repository';

export class ApiError extends Error {
  constructor(public readonly status: number) {
    super(
      status === 401
        ? 'Enter your ID to keep syncing'
        : 'Could not sync. Try again.',
    );
  }
}
export interface Transport {
  request(
    path: string,
    identity: Identity,
    method: string,
    body: unknown,
    signal: AbortSignal,
  ): Promise<unknown>;
  upload(
    file: AudioFile,
    identity: Identity,
    signal: AbortSignal,
  ): Promise<void>;
  cleanup(): Promise<void>;
}
export type SyncStatus =
  | 'Synced'
  | 'Saved on device, will sync'
  | 'Syncing…'
  | 'Could not sync, will retry';
export class SyncEngine {
  private running: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  private enabled = false;
  private online = false;
  private foreground = true;
  private requested = false;
  constructor(
    private readonly repo: Repository,
    private readonly transport: Transport,
    private readonly getIdentity: () => Identity | null,
    private readonly saveIdentity: (identity: Identity) => Promise<void>,
    private readonly onStatus: (status: SyncStatus) => void,
    private readonly onUnauthorized: () => void,
    private readonly afterSync: (applied: AppliedSync) => Promise<void>,
    private readonly onCollision?: () => Promise<Identity>,
  ) {}
  configure(enabled: boolean, online: boolean, foreground = true) {
    this.enabled = enabled;
    this.online = online;
    this.foreground = foreground;
    if (!enabled || !online) {
      this.controller?.abort();
      this.clearTimer();
    }
    if (enabled && online && foreground) this.schedule(0);
  }
  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
  schedule(delay = 2000) {
    if (!this.enabled || !this.online || !this.foreground) return;
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.sync();
    }, delay);
  }
  async stop(): Promise<void> {
    this.enabled = false;
    this.clearTimer();
    this.controller?.abort();
    await this.running;
  }
  sync(): Promise<void> {
    if (!this.enabled || !this.online) return Promise.resolve();
    if (this.running) {
      this.requested = true;
      return this.running;
    }
    this.running = this.run().finally(() => {
      this.running = null;
      if (this.requested) {
        this.requested = false;
        this.schedule();
      }
    });
    return this.running;
  }
  private async run() {
    const controller = new AbortController();
    this.controller = controller;
    const signal = controller.signal;
    const assertActive = () => {
      if (!this.enabled || signal.aborted) throw new Error('Sync stopped');
    };
    try {
      let identity = this.getIdentity();
      if (!identity) return;
      this.onStatus('Syncing…');
      if (!identity.registered) {
        if (!identity.secret) throw new ApiError(401);
        for (let attempt = 0; ; attempt++) {
          try {
            await this.transport.request(
              '/api/ids/register',
              identity,
              'POST',
              { secret: identity.secret },
              signal,
            );
            break;
          } catch (error) {
            if (
              !(error instanceof ApiError) ||
              error.status !== 409 ||
              !this.onCollision ||
              attempt >= 3
            )
              throw error;
            assertActive();
            identity = await this.onCollision();
          }
        }
        assertActive();
        identity = { ...identity, registered: true };
        await this.saveIdentity(identity);
      }
      let uploadFailed = false;
      for (const file of await this.repo.uploads()) {
        assertActive();
        try {
          await this.transport.upload(file, identity, signal);
          assertActive();
          await this.repo.setAudioUploaded(file.audio_id, true);
        } catch (error) {
          assertActive();
          if (error instanceof ApiError && error.status === 401) throw error;
          uploadFailed = true;
        }
      }
      let hasMore = false;
      let missing = false;
      const applied: AppliedSync = { dates: [], settingsChanged: false };
      // Each batch is read once: the loop condition's read is the next push.
      let changes = await this.repo.pushBatch();
      do {
        assertActive();
        const cursor = await this.repo.state('cursor');
        const response: SyncResponse = syncResponseSchema.parse(
          await this.transport.request(
            '/api/sync',
            identity,
            'POST',
            { changes, cursor },
            signal,
          ),
        );
        assertActive();
        if (
          response.hasMore &&
          (!response.changes.length || response.cursor === cursor)
        )
          throw new Error('Sync cursor did not advance');
        const result = await this.repo.applyResponse(changes, response);
        applied.dates.push(...result.dates);
        applied.settingsChanged ||= result.settingsChanged;
        hasMore = response.hasMore;
        if (response.missingAudio.length) missing = true;
        changes = hasMore ? [] : await this.repo.pushBatch();
      } while (hasMore || changes.length > 0);
      assertActive();
      await this.transport.cleanup();
      await this.afterSync(applied);
      const pending = await this.repo.hasDirty();
      this.onStatus(pending ? 'Saved on device, will sync' : 'Synced');
      if (uploadFailed || missing) {
        this.failures++;
        this.schedule(
          Math.min(300_000, 2000 * 2 ** Math.min(this.failures, 8)),
        );
      } else {
        // The loop ended on an empty batch, so remaining dirty rows are waiting
        // on something else; edits made since then queue their own sync.
        this.failures = 0;
      }
    } catch (error) {
      this.onStatus('Saved on device, will sync');
      if (signal.aborted || !this.enabled) return;
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 409)
      ) {
        this.enabled = false;
        this.onUnauthorized();
        return;
      }
      this.onStatus('Could not sync, will retry');
      this.failures++;
      this.schedule(Math.min(300_000, 2000 * 2 ** Math.min(this.failures, 8)));
    }
  }
}
