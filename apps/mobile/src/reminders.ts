import { Alert, AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { DEFAULT_SETTINGS, reminderSchedule } from '@down-up/shared';
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
  private tail: Promise<unknown> = Promise.resolve();
  private promptDeferred = false;
  constructor(
    private readonly repo: Repository,
    private readonly enabled: () => boolean,
    private readonly onPermission: (blocked: boolean) => void,
  ) {}
  foreground(): Promise<void> {
    this.promptDeferred = false;
    return this.rebuild(true);
  }
  rebuild(allowPrompt = false): Promise<void> {
    const result = this.tail.then(async () => {
      await Notifications.cancelAllScheduledNotificationsAsync();
      const settings = (await this.repo.reminder()) ?? DEFAULT_SETTINGS;
      if (!this.enabled() || !settings.reminderEnabled) return;
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
      const dates = await this.repo.loggedDates();
      for (const item of reminderSchedule(
        settings,
        dates,
        new Date(),
        this.enabled(),
        permission.granted,
      )) {
        if (!this.enabled()) break;
        await Notifications.scheduleNotificationAsync({
          identifier: `daily-${item.date}`,
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
      }
    });
    this.tail = result.catch(() => undefined);
    return result;
  }
}
