import type { SyncStatus } from './sync-engine';

export type DataStatus = 'unsaved' | 'local' | 'cloud';

export const DATA_STATUS_TEXT: Record<DataStatus, string> = {
  unsaved: 'Not saved yet',
  local: 'Saved on this phone',
  cloud: 'Saved to the cloud',
};

export type DataStatusInput = {
  notePending: boolean;
  writePending: boolean;
  writeFailed: boolean;
  dirty: boolean;
  syncEnabled: boolean;
  serverConfigured: boolean;
  needsIdentity: boolean;
  online: boolean;
  syncStatus: SyncStatus;
};

// Red when a change isn't on the phone yet, yellow when it's only on the
// phone, green when the server has everything (docs/data-status-icon.md).
export function dataStatus(input: DataStatusInput): DataStatus {
  if (input.notePending || input.writePending || input.writeFailed)
    return 'unsaved';
  if (
    !input.syncEnabled ||
    !input.serverConfigured ||
    input.needsIdentity ||
    !input.online ||
    input.dirty ||
    input.syncStatus !== 'Synced'
  )
    return 'local';
  return 'cloud';
}
