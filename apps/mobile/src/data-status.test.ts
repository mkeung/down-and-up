import { describe, expect, it } from 'vitest';
import { dataStatus, type DataStatusInput } from './data-status';

const synced: DataStatusInput = {
  notePending: false,
  writePending: false,
  writeFailed: false,
  dirty: false,
  syncEnabled: true,
  serverConfigured: true,
  needsIdentity: false,
  online: true,
  syncStatus: 'Synced',
};

describe('data status', () => {
  it('is green only when sync is on and the server has everything', () => {
    expect(dataStatus(synced)).toBe('cloud');
  });
  it('is red while a change is not on the phone yet', () => {
    expect(dataStatus({ ...synced, notePending: true })).toBe('unsaved');
    expect(dataStatus({ ...synced, writePending: true })).toBe('unsaved');
    expect(dataStatus({ ...synced, writeFailed: true })).toBe('unsaved');
  });
  it('is yellow when entries are only on the phone', () => {
    expect(dataStatus({ ...synced, dirty: true })).toBe('local');
    expect(dataStatus({ ...synced, online: false })).toBe('local');
    expect(dataStatus({ ...synced, serverConfigured: false })).toBe('local');
    expect(dataStatus({ ...synced, needsIdentity: true })).toBe('local');
    expect(dataStatus({ ...synced, syncStatus: 'Syncing…' })).toBe('local');
    expect(
      dataStatus({ ...synced, syncStatus: 'Saved on device, will sync' }),
    ).toBe('local');
  });
  it('stays yellow with sync off, even when nothing is dirty', () => {
    expect(dataStatus({ ...synced, syncEnabled: false })).toBe('local');
  });
  it('stays yellow, not red, after a failed sync', () => {
    expect(
      dataStatus({
        ...synced,
        dirty: true,
        syncStatus: 'Could not sync, will retry',
      }),
    ).toBe('local');
  });
  it('lets unsaved win over every other state', () => {
    expect(
      dataStatus({
        ...synced,
        writeFailed: true,
        syncEnabled: false,
        dirty: true,
        online: false,
        syncStatus: 'Could not sync, will retry',
      }),
    ).toBe('unsaved');
  });
});
