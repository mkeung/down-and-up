import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import {
  MAX_AUDIO_BYTES,
  MAX_AUDIO_DURATION_MS,
  type Entry,
} from '@down-up/shared';
import { Action, Row } from './components';
import { reportError, useApp } from './app-context';
import { useTheme } from './theme';
import { withDeadline } from './deadline';
const options = {
  ...RecordingPresets.HIGH_QUALITY,
  directory: 'document' as const,
  numberOfChannels: 1,
  bitRate: 64000,
  android: {
    ...RecordingPresets.HIGH_QUALITY.android,
    maxFileSize: MAX_AUDIO_BYTES,
  },
};
function durationLabel(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
}
export function AudioNote({
  date,
  entry,
  onRecording,
}: {
  date: string;
  entry: Entry | null;
  onRecording: (active: boolean) => void;
}) {
  const { repo, recordingPath } = useApp();
  const theme = useTheme();
  const finishRef = useRef<(finished?: boolean) => Promise<void>>(
    async () => undefined,
  );
  const recorder = useAudioRecorder(options, (status) => {
    if (status.isFinished || status.hasError || status.mediaServicesDidReset)
      void finishRef.current(true).catch(reportError);
  });
  const state = useAudioRecorderState(recorder, 200);
  const player = useAudioPlayer(null);
  const playback = useAudioPlayerStatus(player);
  const loadedAudio = useRef<string | null>(null);
  const session = useRef<{ date: string; started: number } | null>(null);
  const duration = useRef(0);
  if (state.durationMillis > 0) duration.current = state.durationMillis;
  const finishing = useRef(false);
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const operation = useRef(0);
  const finish = useCallback(
    async (finished = false) => {
      const recording = session.current;
      if (!recording || finishing.current) return;
      finishing.current = true;
      setBusy(true);
      try {
        const length = Math.min(
          MAX_AUDIO_DURATION_MS,
          Math.max(1, duration.current || Date.now() - recording.started),
        );
        if (!finished) await withDeadline(recorder.stop(), 15000);
        const uri = recorder.uri;
        if (!uri) throw new Error('The recording could not be saved');
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists || info.size < 1 || info.size > MAX_AUDIO_BYTES)
          throw new Error('The recording could not be saved');
        const audioId = Crypto.randomUUID();
        const directory = `${FileSystem.documentDirectory}recordings/`;
        await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
        const destination = `${directory}${audioId}.m4a`;
        await FileSystem.moveAsync({ from: uri, to: destination });
        await repo.setField(
          recording.date,
          'audio',
          audioId,
          length,
          destination,
        );
      } finally {
        session.current = null;
        finishing.current = false;
        setBusy(false);
        onRecording(false);
        await withDeadline(
          setAudioModeAsync({ allowsRecording: false }),
          15000,
        );
      }
    },
    [repo, recorder, onRecording],
  );
  finishRef.current = finish;
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      return () => {
        active.current = false;
        operation.current++;
        setBusy(false);
        if (!session.current) onRecording(false);
        player.pause();
        void finishRef.current().catch(reportError);
      };
    }, [player, onRecording]),
  );
  useEffect(() => {
    operation.current++;
    setBusy(false);
    if (!session.current) onRecording(false);
    player.pause();
    loadedAudio.current = null;
    if (session.current && session.current.date !== date)
      void finishRef.current().catch(reportError);
  }, [date, player, onRecording]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        operation.current++;
        setBusy(false);
        if (!session.current) onRecording(false);
      }
      if (next !== 'active') {
        player.pause();
        void finishRef.current().catch(reportError);
      }
    });
    return () => {
      subscription.remove();
      void finishRef.current().catch(reportError);
    };
  }, [player, onRecording]);
  useEffect(() => {
    if (state.durationMillis >= MAX_AUDIO_DURATION_MS)
      void finishRef.current().catch(reportError);
  }, [state.durationMillis]);
  const start = async () => {
    if (entry?.audioId) {
      const replace = await new Promise<boolean>((resolve) =>
        Alert.alert(
          'Replace recording?',
          '',
          [
            { text: 'Cancel', onPress: () => resolve(false) },
            { text: 'Replace', onPress: () => resolve(true) },
          ],
          { cancelable: false },
        ),
      );
      if (!replace) return;
    }
    setBusy(true);
    onRecording(true);
    const attempt = ++operation.current;
    const isActive = () =>
      active.current &&
      operation.current === attempt &&
      AppState.currentState === 'active';
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!isActive()) return;
      if (!permission.granted) {
        Alert.alert(
          'Recording is unavailable',
          'Allow microphone access in your phone settings to record audio notes.',
        );
        return;
      }
      player.pause();
      await withDeadline(
        setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          interruptionMode: 'doNotMix',
        }),
        15000,
      );
      if (!isActive()) return;
      await withDeadline(recorder.prepareToRecordAsync(), 15000);
      if (!isActive()) return;
      if (!recorder.getStatus().canRecord)
        throw new Error('Recording is unavailable');
      duration.current = 0;
      session.current = { date, started: Date.now() };
      onRecording(true);
      recorder.record({ forDuration: 300 });
    } catch (error) {
      if (active.current && operation.current === attempt) throw error;
    } finally {
      if (operation.current === attempt) setBusy(false);
      if (operation.current === attempt && !session.current) {
        onRecording(false);
        void setAudioModeAsync({ allowsRecording: false }).catch(
          () => undefined,
        );
      }
    }
  };
  const play = async () => {
    if (!entry?.audioId) return;
    if (playback.playing) {
      player.pause();
      return;
    }
    setBusy(true);
    const attempt = ++operation.current;
    const isActive = () =>
      active.current &&
      operation.current === attempt &&
      AppState.currentState === 'active';
    try {
      const uri = await recordingPath(entry.audioId);
      if (!isActive()) return;
      await withDeadline(
        setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        }),
        15000,
      );
      if (!isActive()) return;
      if (loadedAudio.current !== entry.audioId) {
        player.replace(uri);
        loadedAudio.current = entry.audioId;
      } else if (playback.didJustFinish) await player.seekTo(0);
      if (!isActive()) return;
      player.play();
    } catch (error) {
      if (active.current && operation.current === attempt) throw error;
    } finally {
      if (operation.current === attempt) setBusy(false);
    }
  };
  return (
    <Row>
      {session.current ? (
        <>
          <Text style={{ color: theme.text, fontSize: 18 }}>
            {durationLabel(state.durationMillis)}
          </Text>
          <Action
            label="Stop"
            disabled={busy}
            onPress={() => {
              void finish().catch(reportError);
            }}
          />
        </>
      ) : (
        <>
          <Action
            label="Record"
            disabled={busy}
            onPress={() => {
              void start().catch(reportError);
            }}
          />
          {entry?.audioId && (
            <>
              <Action
                label={playback.playing ? 'Pause recording' : 'Play recording'}
                disabled={busy}
                onPress={() => {
                  void play().catch(reportError);
                }}
              />
              <Text style={{ color: theme.muted }}>
                {durationLabel(entry.audioDurationMs ?? 0)}
              </Text>
              <Action
                label="Delete recording"
                disabled={busy}
                onPress={() =>
                  Alert.alert('Delete recording?', '', [
                    { text: 'Cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => {
                        player.pause();
                        void repo
                          .setField(date, 'audio', null)
                          .catch(reportError);
                      },
                    },
                  ])
                }
              />
            </>
          )}
        </>
      )}
    </Row>
  );
}
