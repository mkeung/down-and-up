export type IdleAnimation = 'sitting-idle' | 'tennis-ball' | 'yarn-ball';
export type CerberusAnimation = 'walking' | 'food-can' | IdleAnimation;
export type CerberusBehavior = {
  animation: CerberusAnimation;
  facingRight: boolean;
  remaining: number;
  target: number;
};

const randomBetween = (minimum: number, maximum: number) =>
  minimum + Math.random() * (maximum - minimum);

export function nextWalk(position: number, travel: number): CerberusBehavior {
  const facingRight =
    position <= 0.05 || (position < 0.95 && Math.random() < 0.5);
  const target = Math.max(
    0,
    Math.min(1, position + (facingRight ? 1 : -1) * randomBetween(0.35, 0.8)),
  );
  return {
    animation: 'walking',
    facingRight,
    target,
    remaining: Math.max(800, Math.abs(target - position) * travel * 55),
  };
}

export function nextIdle(walk: CerberusBehavior): CerberusBehavior {
  const choice = Math.random();
  const animation =
    choice < 0.6 ? 'sitting-idle' : choice < 0.8 ? 'tennis-ball' : 'yarn-ball';
  const remaining =
    animation === 'sitting-idle'
      ? Math.random() < 0.25
        ? randomBetween(14000, 30000)
        : randomBetween(4000, 10000)
      : randomBetween(4500, 9000);
  return { ...walk, animation, remaining };
}
