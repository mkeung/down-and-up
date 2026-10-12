import Svg, { Path } from 'react-native-svg';
import { ropePath, type Point } from './cerberus-tug';

export function CerberusRope({
  mouth,
  finger,
  width,
  height,
}: {
  mouth: Point;
  finger: Point;
  width: number;
  height: number;
}) {
  const d = ropePath(mouth, finger);
  return (
    <Svg
      testID="cerberus-rope"
      pointerEvents="none"
      accessible={false}
      width={width}
      height={height}
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      <Path
        d={d}
        fill="none"
        stroke="#35251d"
        strokeWidth={5}
        strokeLinecap="round"
      />
      <Path
        d={d}
        fill="none"
        stroke="#d4ae6d"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d={d}
        fill="none"
        stroke="#8d6335"
        strokeWidth={1}
        strokeDasharray="2 4"
      />
    </Svg>
  );
}
