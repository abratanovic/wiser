import {Moon, Sun, SlidersHorizontal} from 'lucide-react';
import {LoginButton} from '@/components/LoginButton';
import {useI18n} from '@/lib/i18n';
import {sourceDot, sourceLabel, type Source} from '@/lib/sources';

type Props = {
  isDark: boolean;
  setIsDark: (v: boolean | ((prev: boolean) => boolean)) => void;
  /** Opens the schedule builder, where subjects and groups are chosen. */
  setShowFilterModal: (show: boolean) => void;
  /** When the school last published the timetable, as epoch ms. */
  publishedAt: number | null | undefined;
  /** Sources present in the loaded timetable, and the keys of those the student switched off. */
  sources: Source[];
  hiddenSources: string[];
  onToggleSource: (key: string) => void;
};

export function TimetableControls({
  isDark,
  setIsDark,
  setShowFilterModal,
  publishedAt,
  sources,
  hiddenSources,
  onToggleSource,
}: Props) {
  const {t, locale, setLocale} = useI18n();

  const publishedLabel =
    publishedAt != null
      ? new Intl.DateTimeFormat(t.locale, {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(new Date(publishedAt))
      : null;

  const themeButton = (
    <button
      onClick={() => setIsDark((v) => !v)}
      aria-label='Toggle theme'
      aria-pressed={isDark}
      title={isDark ? t.common.switchToLight : t.common.switchToDark}
      className='p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'>
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );

  const langButton = (
    <button
      onClick={() => setLocale(locale === 'sl' ? 'en' : 'sl')}
      aria-label='Toggle language'
      title={locale === 'sl' ? 'Switch to English' : 'Preklopi v slovenščino'}
      className='p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-xs font-medium tabular-nums'>
      {locale.toUpperCase()}
    </button>
  );

  const builderButton = (
    <button
      onClick={() => setShowFilterModal(true)}
      aria-haspopup='dialog'
      title={t.common.manageFilters}
      className='p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'>
      <SlidersHorizontal size={16} />
    </button>
  );

  const publishedStamp = publishedLabel && (
    <span
      className='text-xs text-muted-foreground tabular-nums'
      title='Urnik nazadnje objavljen'>
      {publishedLabel}
    </span>
  );

  // One faculty has nothing to filter between, so a FERI-only student sees no toggles. They
  // also stay while a present source is switched off, or it could never be switched back on.
  const showSources =
    sources.length > 1 || sources.some((s) => hiddenSources.includes(s.key));

  const sourceToggles = showSources && (
    <div role='group' aria-label={t.details.faculty} className='mr-auto flex flex-wrap gap-1'>
      {sources.map((s) => {
        const on = !hiddenSources.includes(s.key);
        return (
          <button
            key={s.key}
            onClick={() => onToggleSource(s.key)}
            aria-pressed={on}
            title={s.name}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              on
                ? 'border-border bg-muted text-foreground hover:bg-muted/70'
                : 'border-dashed border-border text-muted-foreground hover:text-foreground'
            }`}>
            <span
              aria-hidden
              className={`size-2 rounded-full ${on ? sourceDot(s) : `ring-1 ring-inset ring-current`}`}
            />
            {sourceLabel(s)}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className='mt-3 flex flex-wrap items-center gap-2'>
      {sourceToggles}
      <div className='ml-auto flex items-center gap-0.5'>
        {publishedStamp}
        {publishedStamp && <span className='w-1' />}
        {themeButton}
        {langButton}
        {builderButton}
        <div className='w-px h-4 bg-border mx-1' />
        <LoginButton />
      </div>
    </div>
  );
}
