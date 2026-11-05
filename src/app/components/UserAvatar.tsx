/** A user's profile picture, or their coloured initials when they have none. */
import React, { useEffect, useState } from 'react';
import { getAvatar, onAvatarsChanged } from '../utils/avatars';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'];

export function userColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function userInitials(name: string): string {
  // "ali.hassan" → AH, "MagdaGad" → MG
  const parts = name.trim().split(/[\s._-]+|(?=[A-Z])/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
}

export function UserAvatar({ username, size = 28, className = '' }: { username: string; size?: number; className?: string }) {
  const [image, setImage] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => getAvatar(username).then((img) => { if (live) setImage(img); });
    load();
    const stop = onAvatarsChanged(load);
    return () => { live = false; stop(); };
  }, [username]);

  const style: React.CSSProperties = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  return image ? (
    <img src={image} alt={username} title={username} style={style}
      className={`inline-block shrink-0 rounded-full object-cover shadow-md ring-2 ring-white/40 ${className}`} />
  ) : (
    <span title={username} style={{ ...style, backgroundColor: userColor(username) }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white shadow-md ring-2 ring-white/40 ${className}`}>
      {userInitials(username)}
    </span>
  );
}
