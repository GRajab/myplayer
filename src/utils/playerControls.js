export function formatPlaybackTime(seconds) {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainder = String(value % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${remainder}` : `${minutes}:${remainder}`;
}
export function clampPlaybackPosition(position, duration) {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)) return null;
  return Math.max(0, Math.min(duration, position));
}
export function positionFromTouch(x, width, duration) {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(x)) return null;
  return clampPlaybackPosition(x / width * duration, duration);
}
