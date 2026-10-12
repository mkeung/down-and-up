import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Repository } from './repository';
import { Reminders } from './reminders';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  getPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  schedule: vi.fn(),
  cancel: vi.fn(),
  cancelOne: vi.fn(),
}));
vi.mock('react-native', () => ({
  Alert: { alert: mocks.alert },
  AppState: { currentState: 'active' },
  Platform: { OS: 'ios' },
}));
vi.mock('expo-notifications', () => ({
  setNotificationHandler: vi.fn(),
  cancelAllScheduledNotificationsAsync: mocks.cancel,
  cancelScheduledNotificationAsync: mocks.cancelOne,
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
  mocks.cancelOne.mockResolvedValue(undefined);
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
const granted = { granted: true, canAskAgain: true, status: 'granted' };
function setup(initiallyAsked = false) {
  const state = new Map<string, string>();
  if (initiallyAsked) state.set('notification_asked', 'true');
  let enabled = true;
  const onPermission = vi.fn();
  const logged = new Set<string>();
  const settings = { reminderEnabled: true, reminderTime: '20:00' };
  const loggedDates = vi.fn(async (from: string) => {
    return new Set([...logged].filter((date) => date >= from));
  });
  const repo = {
    reminder: async () => settings,
    state: async (key: string) => state.get(key) ?? null,
    setState: async (key: string, value: string) => {
      state.set(key, value);
    },
    loggedDates,
  } as unknown as Repository;
  return {
    state,
    logged,
    settings,
    loggedDates,
    onPermission,
    disable: () => {
      enabled = false;
    },
    reminders: new Reminders(repo, () => enabled, onPermission),
  };
}

describe('reminder permissions', () => {
  it('coalesces edits during scheduling into one trailing rebuild', async () => {
    const { reminders } = setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mocks.cancel.mockReturnValueOnce(gate);
    mocks.getPermissions.mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: 'granted',
    });
    const running = reminders.rebuild();
    const pending = Array.from({ length: 10 }, () => reminders.rebuild());
    expect(mocks.cancel).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([running, ...pending]);
    expect(mocks.getPermissions).toHaveBeenCalledTimes(2);
    // The trailing pass found nothing new, so nothing was rescheduled.
    expect(mocks.cancel).toHaveBeenCalledTimes(1);
    expect(mocks.schedule).toHaveBeenCalledTimes(30);
  });
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

describe('reminder schedule updates', () => {
  const today = new Date(2026, 9, 12, 9, 0);
  const ids = (calls: unknown[][]) =>
    calls.map((call) => (call[0] as { identifier: string }).identifier);
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(today);
    mocks.getPermissions.mockResolvedValue(granted);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads logged days only from today and skips days with a value', async () => {
    const { reminders, logged, loggedDates } = setup();
    logged.add('2026-10-13');
    await reminders.rebuild();
    expect(loggedDates).toHaveBeenCalledExactlyOnceWith('2026-10-12');
    const scheduled = ids(mocks.schedule.mock.calls);
    expect(scheduled).toHaveLength(29);
    expect(scheduled).toContain('daily-2026-10-12');
    expect(scheduled).not.toContain('daily-2026-10-13');
    const first = mocks.schedule.mock.calls[0]![0] as {
      content: { title: string; body: string };
      trigger: { date: Date };
    };
    expect(first.content).toMatchObject({
      title: 'Down & Up',
      body: 'Reminder',
    });
    // Phone-local time.
    expect(first.trigger.date).toEqual(new Date(2026, 9, 12, 20, 0));
  });

  it("cancels only today's reminder when today's value is saved", async () => {
    const { reminders, logged } = setup();
    await reminders.rebuild();
    mocks.schedule.mockClear();
    logged.add('2026-10-12');
    await reminders.logged('2026-10-12');
    expect(mocks.cancelOne).toHaveBeenCalledExactlyOnceWith('daily-2026-10-12');
    expect(mocks.cancel).toHaveBeenCalledTimes(1);
    expect(mocks.schedule).not.toHaveBeenCalled();
    // A later rebuild agrees with the single cancel and changes nothing.
    await reminders.rebuild();
    expect(mocks.cancelOne).toHaveBeenCalledTimes(1);
    expect(mocks.schedule).not.toHaveBeenCalled();
  });

  it('ignores values saved for earlier days', async () => {
    const { reminders } = setup();
    await reminders.rebuild();
    expect(reminders.affects('2026-10-11')).toBe(false);
    expect(reminders.affects('2026-10-12')).toBe(true);
    await reminders.logged('2026-10-11');
    expect(mocks.cancelOne).not.toHaveBeenCalled();
    expect(mocks.getPermissions).toHaveBeenCalledTimes(1);
  });

  it('defers to a running rebuild so a stale read cannot reschedule a logged day', async () => {
    const { reminders, logged } = setup();
    await reminders.rebuild();
    let release!: () => void;
    mocks.getPermissions.mockReturnValueOnce(
      new Promise((resolve) => {
        release = () => resolve(granted);
      }),
    );
    const running = reminders.rebuild();
    logged.add('2026-10-12');
    const saved = reminders.logged('2026-10-12');
    release();
    await Promise.all([running, saved]);
    expect(mocks.getPermissions).toHaveBeenCalledTimes(3);
    expect(mocks.cancelOne).toHaveBeenCalledExactlyOnceWith('daily-2026-10-12');
  });

  it('moves every reminder when the time changes and clears them when turned off', async () => {
    const { reminders, settings } = setup();
    await reminders.rebuild();
    settings.reminderTime = '07:30';
    mocks.schedule.mockClear();
    await reminders.rebuild();
    // Today's 07:30 has passed, so only the next 29 days are rescheduled.
    expect(mocks.cancelOne).toHaveBeenCalledTimes(30);
    expect(mocks.schedule).toHaveBeenCalledTimes(29);
    mocks.cancelOne.mockClear();
    settings.reminderEnabled = false;
    await reminders.rebuild();
    expect(mocks.cancelOne).toHaveBeenCalledTimes(29);
    expect(mocks.cancel).toHaveBeenCalledTimes(1);
  });

  it('cancels everything again after a failed build', async () => {
    const { reminders } = setup();
    mocks.schedule.mockRejectedValueOnce(new Error('Unavailable'));
    await expect(reminders.rebuild()).rejects.toThrow('Unavailable');
    await reminders.rebuild();
    expect(mocks.cancel).toHaveBeenCalledTimes(2);
    expect(mocks.schedule).toHaveBeenCalledTimes(31);
  });
});
