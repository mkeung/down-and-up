import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PawsitiveConfetti } from './pawsitive-confetti';
import type { CerberusRequest } from './cerberus-context';

const mocks = vi.hoisted(() => ({
  request: { sequence: 0, animation: null } as CerberusRequest,
  query: vi.fn(),
  motion: null as null | ((value: boolean) => void),
  state: null as null | ((value: string) => void),
  keyboard: new Map<string, () => void>(),
  keyboardVisible: false,
  remove: vi.fn(),
  stop: vi.fn(),
  timing: vi.fn(),
  finish: null as null | ((result: { finished: boolean }) => void),
  width: 400,
}));
vi.mock('./cerberus-context', () => ({
  useCerberusRequest: () => mocks.request,
}));
vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Path: 'Path',
  Rect: 'Rect',
}));
vi.mock('react-native', () => ({
  View: 'View',
  StyleSheet: { absoluteFill: { position: 'absolute' } },
  useWindowDimensions: () => ({ width: mocks.width, height: 850 }),
  Easing: { linear: 'linear' },
  Animated: {
    View: 'AnimatedView',
    Value: class {
      interpolate(config: unknown) {
        return config;
      }
    },
    timing: mocks.timing,
  },
  AccessibilityInfo: {
    isReduceMotionEnabled: mocks.query,
    addEventListener: (_event: string, callback: (value: boolean) => void) => {
      mocks.motion = callback;
      return { remove: mocks.remove };
    },
  },
  AppState: {
    currentState: 'active',
    addEventListener: (_event: string, callback: (value: string) => void) => {
      mocks.state = callback;
      return { remove: mocks.remove };
    },
  },
  Keyboard: {
    isVisible: () => mocks.keyboardVisible,
    addListener: (event: string, callback: () => void) => {
      mocks.keyboard.set(event, callback);
      return { remove: mocks.remove };
    },
  },
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer;
const tree = (visible = true) => createElement(PawsitiveConfetti, { visible });
const overlays = () =>
  renderer.root.findAllByProps({ testID: 'pawsitive-confetti' });
async function mount() {
  await act(async () => {
    renderer = create(tree());
  });
}
async function request(animation: CerberusRequest['animation'] = 'food-can') {
  mocks.request = { sequence: mocks.request.sequence + 1, animation };
  await act(async () => renderer.update(tree()));
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.request = { sequence: 0, animation: null };
  mocks.keyboardVisible = false;
  mocks.width = 400;
  mocks.keyboard.clear();
  mocks.query.mockResolvedValue(false);
  mocks.timing.mockImplementation(() => ({
    start(callback: typeof mocks.finish) {
      mocks.finish = callback;
    },
    stop: mocks.stop,
  }));
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

it.each(['food-can', 'backflip'] as const)(
  'showers bones and yarn balls once for %s, then removes the overlay',
  async (animation) => {
    await mount();
    expect(overlays()).toHaveLength(0);
    await request(animation);
    expect(overlays()).toHaveLength(1);
    expect(
      renderer.root.findAllByProps({ testID: 'confetti-bone' }),
    ).toHaveLength(14);
    expect(
      renderer.root.findAllByProps({ testID: 'confetti-yarn' }),
    ).toHaveLength(14);
    expect(overlays()[0]!.props.pointerEvents).toBe('none');
    expect(overlays()[0]!.props.accessibilityElementsHidden).toBe(true);
    expect(mocks.timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        duration: 2400,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    await act(async () => mocks.finish!({ finished: true }));
    expect(overlays()).toHaveLength(0);
    await act(async () => renderer.update(tree()));
    expect(mocks.timing).toHaveBeenCalledTimes(1);
  },
);

it('waits for keyboard dismissal before starting', async () => {
  mocks.keyboardVisible = true;
  await mount();
  await request();
  expect(overlays()).toHaveLength(0);
  expect(mocks.timing).not.toHaveBeenCalled();
  await act(async () => mocks.keyboard.get('keyboardDidHide')!());
  expect(overlays()).toHaveLength(1);
});

it('does not celebrate keypad reactions or requests already present on mount', async () => {
  mocks.request = { sequence: 1, animation: 'backflip' };
  await mount();
  await request('reaction-07');
  expect(mocks.timing).not.toHaveBeenCalled();
});

it.each(['enabled', 'unreadable', 'loading'])(
  'suppresses falling motion when Reduce Motion is %s',
  async (preference) => {
    if (preference === 'enabled') mocks.query.mockResolvedValue(true);
    if (preference === 'unreadable')
      mocks.query.mockRejectedValue(new Error('Unavailable'));
    if (preference === 'loading')
      mocks.query.mockReturnValue(new Promise(() => {}));
    await mount();
    await request();
    expect(mocks.timing).not.toHaveBeenCalled();
    await act(async () => mocks.motion!(false));
    expect(mocks.timing).not.toHaveBeenCalled();
  },
);

it.each(['route', 'background', 'keyboard', 'motion', 'resize'])(
  'cancels the shower on %s and does not replay on return',
  async (reason) => {
    await mount();
    await request();
    await act(async () => {
      if (reason === 'route') renderer.update(tree(false));
      if (reason === 'background') mocks.state!('background');
      if (reason === 'keyboard') mocks.keyboard.get('keyboardDidShow')!();
      if (reason === 'motion') mocks.motion!(true);
      if (reason === 'resize') {
        mocks.width = 700;
        renderer.update(tree());
      }
    });
    expect(overlays()).toHaveLength(0);
    expect(mocks.stop).toHaveBeenCalled();
    await act(async () => {
      renderer.update(tree());
      mocks.state!('active');
      mocks.keyboard.get('keyboardDidHide')!();
      mocks.motion!(false);
      if (reason === 'resize') mocks.width = 400;
      renderer.update(tree());
    });
    expect(overlays()).toHaveLength(0);
    expect(mocks.timing).toHaveBeenCalledTimes(1);
  },
);

it('discards a queued celebration if the app backgrounds before the keyboard closes', async () => {
  mocks.keyboardVisible = true;
  await mount();
  await request();
  await act(async () => mocks.state!('background'));
  await act(async () => {
    mocks.state!('active');
    mocks.keyboard.get('keyboardDidHide')!();
  });
  expect(mocks.timing).not.toHaveBeenCalled();
});

it('replaces an active shower on a new submission and ignores its stale completion', async () => {
  await mount();
  await request();
  const finishFirst = mocks.finish!;
  await request('backflip');
  expect(mocks.stop).toHaveBeenCalled();
  expect(mocks.timing).toHaveBeenCalledTimes(2);
  await act(async () => finishFirst({ finished: true }));
  expect(overlays()).toHaveLength(1);
  await act(async () => mocks.finish!({ finished: true }));
  expect(overlays()).toHaveLength(0);
});
