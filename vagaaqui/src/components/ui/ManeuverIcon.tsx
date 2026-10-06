import { ArrowUp, CornerUpLeft, CornerUpRight, Flag, Navigation2 } from 'lucide-react';
import type { RouteInstruction } from '../../types';

export function ManeuverIcon({ type, size = 30 }: { type: RouteInstruction['type'] | undefined; size?: number }) {
  if (type === 'left') return <CornerUpLeft size={size} />;
  if (type === 'right') return <CornerUpRight size={size} />;
  if (type === 'arrive') return <Flag size={size} />;
  if (type === 'start') return <Navigation2 size={size} />;
  return <ArrowUp size={size} />;
}
