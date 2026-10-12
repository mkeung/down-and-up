import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Repository } from './repository';
import { Reminders } from './reminders';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  getPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  schedule: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock('react-native', () => ({
  Alert: { alert: mocks.alert },
  AppState: { currentState: 'active' },
  Platform: { OS: 'ios' },
}));
vi.mock('expo-notifications', () => ({
  setNotificationHandler: vi.fn(),
  cancelAllScheduledNotificationsAsync: mocks.cancel,
  getPermissionsAsync: mocks.getPermissions,
  requestPermissionsAsync: mocks.requestPermissions,
  scheduleNotificationAsync: mocks.schedule,
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));
const undetermined = {
  granted: false,
  canAskAgain: true,
  status: 'undetermined',
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getPermissions.mockResolvedValue(undetermined);
  mocks.requestPermissions.mockResolvedValue({
    granted: true,
    canAskAgain: true,
    status: 'granted',
  });
});
function choose(text: string) {
  mocks.alert.mockImplementation(
    (
      _title: string,
      _message: string,
      buttons: { text: string; onPress: () => void }[],
    ) => buttons.find((button) => button.text === text)!.onPress(),
  );
}
function setup(initiallyAsked = false) {
  const state = new Map<string, string>();
  if (initiallyAsked) state.set('notification_asked', 'true');
  let enabled = true;
  const onPermission = vi.fn();
  const repo = {
    reminder: async () => ({ reminderEnabled: true, reminderTime: '20:00' }),
    state: async (key: string) => state.get(key) ?? null,
    setState: async (key: string, value: string) => {
      state.set(key, value);
    },
    loggedDates: async () => new Set<string>(),
  } as unknown as Repository;
  return {
    state,
    onPermission,
    disable: () => {
      enabled = false;
    },
    reminders: new Reminders(repo, () => enabled, onPermission),
  };
}

describe('reminder permissions', () => {
  it('allows a later permission request after choosing Not now', async () => {
    const { reminders, state } = setup();
    choose('Not now');
    await reminders.rebuild(true);
    expect(state.has('notification_asked')).toBe(false);
    expect(mocks.requestPermissions).not.toHaveBeenCalled();
    expect(mocks.schedule).not.toHaveBeenCalled();
    await reminders.rebuild(true);
    expect(mocks.alert).toHaveBeenCalledTimes(1);
    choose('Continue');
    await reminders.foreground();
    expect(mocks.requestPermissions).toHaveBeenCalledTimes(1);
    expect(state.get('notification_asked')).toBe('true');
    expect(mocks.schedule).toHaveBeenCalled();
  });

  it('recovers an old asked flag when OS permission was never requested', async () => {
    const { reminders } = setup(true);
    choose('Continue');
    await reminders.rebuild(true);
    expect(mocks.requestPermissions).toHaveBeenCalledTimes(1);
  });

  it('exposes Settings guidance after a denial even if the OS can ask again', async () => {
    const { reminders, onPermission } = setup();
    const denied = { granted: false, canAskAgain: true, status: 'denied' };
    mocks.requestPermissions.mockResolvedValue(denied);
    choose('Continue');
    await reminders.rebuild(true);
    expect(onPermission).toHaveBeenLastCalledWith(true);
    expect(mocks.schedule).not.toHaveBeenCalled();
    mocks.getPermissions.mockResolvedValue(denied);
    await reminders.rebuild(true);
    expect(mocks.requestPermissions).toHaveBeenCalledTimes(1);
  });

  it('does not mark permission as asked if sync is turned off during the explanation', async () => {
    const { reminders, disable, state } = setup();
    mocks.alert.mockImplementation(
      (
        _title: string,
        _message: string,
        buttons: { text: string; onPress: () => void }[],
      ) => {
        disable();
        buttons.find((button) => button.text === 'Continue')!.onPress();
      },
    );
    await reminders.rebuild(true);
    expect(state.has('notification_asked')).toBe(false);
    expect(mocks.requestPermissions).not.toHaveBeenCalled();
    expect(mocks.schedule).not.toHaveBeenCalled();
  });

  it('can retry if requesting OS permission itself fails', async () => {
    const { reminders, state } = setup();
    choose('Continue');
    mocks.requestPermissions.mockRejectedValueOnce(new Error('Unavailable'));
    await expect(reminders.rebuild(true)).rejects.toThrow('Unavailable');
    expect(state.has('notification_asked')).toBe(false);
    await reminders.rebuild(true);
    expect(mocks.requestPermissions).toHaveBeenCalledTimes(2);
  });
});
