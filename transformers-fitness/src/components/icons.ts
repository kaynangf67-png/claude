import {
  Drum,
  Dumbbell,
  Flame,
  HeartPulse,
  Lock,
  Music,
  PartyPopper,
  RefreshCw,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { ActivityIcon, AmenityIcon } from '../config/academia';

export const activityIcons: Record<ActivityIcon, LucideIcon> = {
  dumbbell: Dumbbell,
  zap: Zap,
  flame: Flame,
  heart: HeartPulse,
  drum: Drum,
  music: Music,
  party: PartyPopper,
  circuit: RefreshCw,
};

export const amenityIcons: Record<AmenityIcon, LucideIcon> = {
  dumbbell: Dumbbell,
  users: Users,
  heart: HeartPulse,
  lock: Lock,
};
