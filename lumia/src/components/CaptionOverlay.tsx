import { Bell, CloudRain, DoorClosed, DoorOpen, Footprints, HeartPulse, Music, Phone, VolumeX, Zap, Volume2, Hand } from 'lucide-react';
import type { SoundEvent, SoundType, TimedCue } from '@/ai/types';
import { EMOTION_LABEL, type Emotion } from '@/ai/types';

const SOUND_ICON: Partial<Record<SoundType, typeof Bell>> = {
  DOOR_SLAM: DoorClosed,
  DOOR_CREAK: DoorOpen,
  PHONE_RING: Phone,
  FOOTSTEPS: Footprints,
  RAIN: CloudRain,
  MUSIC_TENSE: Music,
  MUSIC_SOFT: Music,
  SUDDEN_SILENCE: VolumeX,
  KNOCK: Hand,
  HEARTBEAT_BASS: HeartPulse,
  IMPACT: Zap,
  DOORBELL: Bell,
};

export function SoundCues({ sounds, t }: { sounds: SoundEvent[]; t: number }) {
  const active = sounds.filter((s) => t >= s.start && t < s.end);
  if (!active.length) return null;
  return (
    <div className="sound-cues" aria-live="polite">
      {active.map((s) => {
        const Icon = SOUND_ICON[s.type] ?? Volume2;
        return (
          <div key={s.id} className="sound-cue" data-imp={s.importance}>
            <span className="ico">
              <Icon size={16} />
            </span>
            <span>🔊 [{s.label.toUpperCase()}]</span>
          </div>
        );
      })}
    </div>
  );
}

export function Captions({
  cues,
  t,
  size,
  speakerColors,
  showSpeaker,
  emotion,
  padding,
}: {
  cues: TimedCue[];
  t: number;
  size: 'S' | 'M' | 'L';
  speakerColors: Record<string, string>;
  showSpeaker: boolean;
  emotion: { who: string | null; emotion: Emotion; mood?: boolean } | null;
  padding: { left: number; right: number };
}) {
  const active = cues.filter((c) => t >= c.start && t < c.end);
  return (
    <div className="captions" data-size={size} style={{ paddingLeft: padding.left, paddingRight: padding.right }} aria-live="off">
      {emotion && emotion.emotion !== 'neutral' && (
        <span className="caption-emotion">
          🎭 {emotion.who ? `${emotion.who} · ` : emotion.mood ? 'clima: ' : ''}
          {EMOTION_LABEL[emotion.emotion]}
        </span>
      )}
      {active.map((c) => (
        <div key={c.id} className="caption-line">
          {showSpeaker && c.voice && (
            <span className="caption-speaker" style={{ color: speakerColors[c.voice] ?? 'var(--amber)' }}>
              {c.voice}:
            </span>
          )}
          {c.text}
        </div>
      ))}
    </div>
  );
}
