import {
  Accessibility,
  Activity,
  Dumbbell,
  Flame,
  Music,
  Shirt,
  Snowflake,
  Swords,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { ActivityIcon, AmenityIcon } from '../config/academia';

export const activityIcons: Record<ActivityIcon, LucideIcon> = {
  dumbbell: Dumbbell,
  activity: Activity,
  flame: Flame,
  zap: Zap,
  music: Music,
  swords: Swords,
};

export const amenityIcons: Record<AmenityIcon, LucideIcon> = {
  snowflake: Snowflake,
  shirt: Shirt,
  wifi: Wifi,
  accessibility: Accessibility,
};
