import { Alert, AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  DEFAULT_SETTINGS,
  reminderSchedule,
  todayLocal,
} from '@down-up/shared';
import type { Repository } from './repository';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
export class Reminders {
  private running: Promise<void> | null = null;
  private requested = false;
  private allowPrompt = false;
  private promptDeferred = false;
  // Identifier -> trigger time of what this process scheduled. Null means
  // unknown (first build or a failed one), so the next build cancels all.
  private scheduled: Map<string, number> | null = null;
  constructor(
    private readonly repo: Repository,
    private readonly enabled: () => boolean,
    private readonly onPermission: (blocked: boolean) => void,
  ) {}
  foreground(): Promise<void> {
    this.promptDeferred = false;
    return this.rebuild(true);
  }
  // Reminders only exist for today onward, so only those days can matter.
  affects(date: string, now = new Date()): boolean {
    return date >= todayLocal(now);
  }
  // A saved value can never be cleared, so a logged day only loses its
  // reminder. Cancel that one instead of rebuilding the whole schedule.
  logged(date: string): Promise<void> {
    if (!this.affects(date)) return Promise.resolve();
    // A running build may have read the days before this value was saved.
    if (this.running || !this.scheduled) return this.rebuild();
    const identifier = `daily-${date}`;
    if (!this.scheduled.has(identifier)) return Promise.resolve();
    this.scheduled.delete(identifier);
    return Notifications.cancelScheduledNotificationAsync(identifier).catch(
      (error: unknown) => {
        this.scheduled = null;
        throw error;
      },
    );
  }
  rebuild(allowPrompt = false): Promise<void> {
    this.requested = true;
    this.allowPrompt ||= allowPrompt;
    if (this.running) return this.running;
    this.running = (async () => {
      do {
        this.requested = false;
        const prompt = this.allowPrompt;
        this.allowPrompt = false;
        try {
          await this.rebuildOnce(prompt);
        } catch (error) {
          this.scheduled = null;
          throw error;
        }
      } while (this.requested);
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  private async rebuildOnce(allowPrompt: boolean): Promise<void> {
    if (!this.scheduled) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      this.scheduled = new Map();
    }
    const settings = (await this.repo.reminder()) ?? DEFAULT_SETTINGS;
    if (!this.enabled() || !settings.reminderEnabled) {
      await this.apply([]);
      return;
    }
    if (Platform.OS === 'android')
      await Notifications.setNotificationChannelAsync('daily', {
        name: 'Reminder',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: null,
      });
    let permission = await Notifications.getPermissionsAsync();
    let asked =
      (await this.repo.state('notification_asked')) === 'true' &&
      permission.status !== 'undetermined';
    if (
      !permission.granted &&
      permission.canAskAgain &&
      allowPrompt &&
      !this.promptDeferred &&
      AppState.currentState === 'active' &&
      !asked
    ) {
      const proceed = await new Promise<boolean>((resolve) =>
        Alert.alert(
          'Reminder',
          'Allow reminders on this phone?',
          [
            { text: 'Not now', onPress: () => resolve(false) },
            { text: 'Continue', onPress: () => resolve(true) },
          ],
          { cancelable: false },
        ),
      );
      if (proceed && this.enabled()) {
        permission = await Notifications.requestPermissionsAsync();
        await this.repo.setState('notification_asked', 'true');
        asked = true;
      }
      if (!proceed) this.promptDeferred = true;
    }
    this.onPermission(
      !permission.granted && (!permission.canAskAgain || asked),
    );
    const now = new Date();
    const dates = await this.repo.loggedDates(todayLocal(now));
    await this.apply(
      reminderSchedule(
        settings,
        dates,
        now,
        this.enabled(),
        permission.granted,
      ),
    );
  }
  // Cancels and schedules only the difference from what is already pending.
  private async apply(items: readonly { date: string; at: Date }[]) {
    const scheduled = this.scheduled!;
    const wanted = new Map(
      items.map((item): [string, (typeof items)[number]] => [
        `daily-${item.date}`,
        item,
      ]),
    );
    for (const [identifier, at] of [...scheduled]) {
      if (wanted.get(identifier)?.at.getTime() === at) continue;
      scheduled.delete(identifier);
      await Notifications.cancelScheduledNotificationAsync(identifier);
    }
    for (const [identifier, item] of wanted) {
      if (scheduled.has(identifier)) continue;
      if (!this.enabled()) break;
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: 'Down & Up',
          body: 'Reminder',
          data: { date: item.date },
          sound: false,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: item.at,
          channelId: 'daily',
        },
      });
      scheduled.set(identifier, item.at.getTime());
    }
  }
}
