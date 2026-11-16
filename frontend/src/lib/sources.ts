import type {TimetableSession} from './wiseApi';

export type Source = TimetableSession['source'];

/**
 * A short tag that fits on a narrow class block. Wise names arrive as the school slug
 * ("WTT_UM_FERI" → "FERI"); a manual faculty's full name becomes the initials of its first
 * clause ("Fakultet islamskih nauka, Univerzitet u Sarajevu" → "FIN").
 */
export function sourceLabel(source: Source): string {
  if (source.kind === 'wise') return source.name.split('_').pop() || source.name;
  const words = source.name.split(',')[0].trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return (words[0] ?? source.name).slice(0, 6);
  return words.map((w) => w[0]).join('').toUpperCase().slice(0, 5);
}

// Dot colours stay clear of the type palette's pastels, so they read as "which school", not
// "which kind of class". Keyed by id rather than position, so a faculty keeps its colour in
// weeks where another one has no classes.
const DOTS = ['bg-violet-500', 'bg-emerald-500', 'bg-orange-500', 'bg-rose-500', 'bg-teal-500'];

export function sourceDot(source: Source): string {
  if (source.kind === 'wise') return 'bg-blue-500';
  return DOTS[(Number(source.key.split(':')[1]) || 0) % DOTS.length];
}

/** Distinct sources in the order a reader expects: Wise first, then manual faculties by name. */
export function sourcesOf(events: {source: Source}[]): Source[] {
  const byKey = new Map<string, Source>();
  for (const e of events) byKey.set(e.source.key, e.source);
  return [...byKey.values()].sort(
    (a, b) =>
      Number(b.kind === 'wise') - Number(a.kind === 'wise') || a.name.localeCompare(b.name),
  );
}
