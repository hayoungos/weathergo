import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import type { Condition } from '@/lib/weather/condition';

// 서비스 전용 날씨 아이콘 세트 (64×64 기준)
const SUN = '#FFB020';
const SUN_RAY = '#FFC54D';
const CLOUD_LIGHT = '#D5DEE8';
const CLOUD_MID = '#B4C0CE';
const CLOUD_DARK = '#8D9AAA';
const RAIN = '#3B8BEB';
const SNOW = '#6FB3EE';

const CLOUD_PATH = 'M19 46 H46 A9.5 9.5 0 0 0 47.6 27.1 A13.5 13.5 0 0 0 22.4 29.4 A8.4 8.4 0 0 0 19 46 Z';

function Sun({ cx, cy, r, rays = true }: { cx: number; cy: number; r: number; rays?: boolean }) {
  const lines = [];
  if (rays) {
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i;
      const r1 = r + 4;
      const r2 = r + 9;
      lines.push(
        <Line
          key={i}
          x1={cx + Math.cos(a) * r1}
          y1={cy + Math.sin(a) * r1}
          x2={cx + Math.cos(a) * r2}
          y2={cy + Math.sin(a) * r2}
          stroke={SUN_RAY}
          strokeWidth={3}
          strokeLinecap="round"
        />,
      );
    }
  }
  return (
    <G>
      {lines}
      <Circle cx={cx} cy={cy} r={r} fill={SUN} />
    </G>
  );
}

function Cloud({ fill, dy = 0 }: { fill: string; dy?: number }) {
  return <Path d={CLOUD_PATH} fill={fill} transform={`translate(0 ${dy})`} />;
}

function Drop({ x, y }: { x: number; y: number }) {
  return <Line x1={x} y1={y} x2={x - 3} y2={y + 8} stroke={RAIN} strokeWidth={3.2} strokeLinecap="round" />;
}

function Flake({ x, y }: { x: number; y: number }) {
  const s = 4;
  return (
    <G stroke={SNOW} strokeWidth={2.2} strokeLinecap="round">
      <Line x1={x - s} y1={y} x2={x + s} y2={y} />
      <Line x1={x - s * 0.5} y1={y - s * 0.87} x2={x + s * 0.5} y2={y + s * 0.87} />
      <Line x1={x - s * 0.5} y1={y + s * 0.87} x2={x + s * 0.5} y2={y - s * 0.87} />
    </G>
  );
}

function Glyph({ condition }: { condition: Condition | null }) {
  switch (condition) {
    case 'clear':
      return <Sun cx={32} cy={32} r={12} />;
    case 'partlyCloudy':
      return (
        <G>
          <Sun cx={24} cy={24} r={9} />
          <Cloud fill={CLOUD_LIGHT} dy={4} />
        </G>
      );
    case 'cloudy':
      return (
        <G>
          <Path d={CLOUD_PATH} fill={CLOUD_MID} transform="translate(-6 -7) scale(0.85)" />
          <Cloud fill={CLOUD_LIGHT} dy={3} />
        </G>
      );
    case 'rain':
      return (
        <G>
          <Cloud fill={CLOUD_DARK} dy={-8} />
          <Drop x={24} y={44} />
          <Drop x={33} y={44} />
          <Drop x={42} y={44} />
        </G>
      );
    case 'shower':
      return (
        <G>
          <Sun cx={22} cy={18} r={7} />
          <Cloud fill={CLOUD_MID} dy={-6} />
          <Drop x={28} y={46} />
          <Drop x={39} y={46} />
        </G>
      );
    case 'snow':
      return (
        <G>
          <Cloud fill={CLOUD_MID} dy={-8} />
          <Flake x={23} y={48} />
          <Flake x={33} y={53} />
          <Flake x={43} y={48} />
        </G>
      );
    case 'sleet':
      return (
        <G>
          <Cloud fill={CLOUD_DARK} dy={-8} />
          <Drop x={25} y={44} />
          <Flake x={34} y={51} />
          <Drop x={44} y={44} />
        </G>
      );
    default:
      // 예보 미제공
      return (
        <G>
          <Circle cx={32} cy={32} r={17} fill="none" stroke="#C3CBD5" strokeWidth={2.5} strokeDasharray="4 4" />
          <SvgText x={32} y={39} fontSize={20} fontWeight="700" fill="#AEB8C4" textAnchor="middle">
            ?
          </SvgText>
        </G>
      );
  }
}

export function WeatherIcon({ condition, size = 32 }: { condition: Condition | null; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel={condition ?? '예보 미제공'}>
      <Glyph condition={condition} />
    </Svg>
  );
}
