import {useCallback, useEffect, useRef, useState} from 'react';
import {CalendarClock, CalendarX2, Check, Loader2, Pencil, Plus, Trash2, Undo2, X} from 'lucide-react';
import type {TimetableEvent} from '@/types/TimetableEvent';
import {Modal} from '@/components/Modal';
import {useAuth} from '@/contexts/AuthContext.shared';
import {
  ApiError,
  createManualFaculty,
  createManualSlot,
  createManualSubject,
  deleteManualFaculty,
  deleteManualSlot,
  deleteManualSubject,
  deleteSlotException,
  getManualFaculties,
  putSlotException,
  updateManualFaculty,
  updateManualSlot,
  updateManualSubject,
  type FacultyInput,
  type ManualFaculty,
  type ManualSlot,
  type ManualSubject,
  type SlotInput,
} from '@/lib/api';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called after every saved change with whether any faculty remains, so the grid refetches. */
  onChanged: (hasAny: boolean) => void;
  /** Opens on the faculty owning this slot with the slot's form open ("edit weekly slot"). */
  focusSlotId?: number | null;
};

/** Runs one API call with the token, then reloads the faculties and tells the timetable. */
type Commit = (call: (token: string) => Promise<unknown>) => Promise<void>;

const btn = 'inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md transition-colors disabled:opacity-50';
const btnGhost = `${btn} border border-border/60 hover:bg-muted`;
const btnPrimary = `${btn} bg-blue-600 text-white hover:bg-blue-700`;
const iconBtn = 'p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const input = 'w-full rounded-md border bg-card px-2 py-2 text-sm dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-ring aria-[invalid=true]:border-rose-500';
const chip = (active: boolean) =>
  `${btn} ${active ? 'bg-blue-600/15 border border-blue-600/40 text-blue-700 dark:text-blue-300' : 'border border-border/60 hover:bg-muted'}`;

const DAYS = ['Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota', 'Nedelja'];
const DAYS_SHORT = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned'];

export function ManualFacultyEditor({open, onClose, onChanged, focusSlotId}: Props) {
  const {token} = useAuth();
  const [faculties, setFaculties] = useState<ManualFaculty[] | null>(null);
  const [selected, setSelected] = useState<number | 'new'>('new');
  const [editingSlot, setEditingSlot] = useState<number | 'new' | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    setLoadError(null);
    getManualFaculties(token)
      .then((list) => {
        if (cancelled) return;
        setFaculties(list);
        const owner = focusSlotId != null
          ? list.find((f) => f.subjects.some((s) => s.slots.some((x) => x.id === focusSlotId)))
          : undefined;
        setSelected((cur) => owner?.id ?? (list.some((f) => f.id === cur) ? cur : list[0]?.id ?? 'new'));
        setEditingSlot(owner ? focusSlotId! : null);
      })
      .catch((e) => !cancelled && setLoadError(messageOf(e)));
    return () => {
      cancelled = true;
    };
  }, [open, token, focusSlotId]);

  const commit: Commit = useCallback(
    async (call) => {
      if (!token) throw new Error('Prijava je potekla. Prijavi se znova.');
      await call(token);
      const list = await getManualFaculties(token);
      setFaculties(list);
      onChanged(list.length > 0);
    },
    [token, onChanged],
  );

  const faculty = faculties?.find((f) => f.id === selected);

  return (
    <Modal
      open={open}
      title='Fakultete brez Wise'
      onClose={onClose}
      footer={<button className={btnGhost} onClick={onClose}>Zapri</button>}>
      {loadError ? (
        <p className='rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300'>
          {loadError}
        </p>
      ) : !faculties ? (
        <p className='flex items-center gap-2 text-sm text-muted-foreground'>
          <Loader2 size={15} className='animate-spin' /> Nalagam…
        </p>
      ) : (
        <div className='space-y-6'>
          {faculties.length > 0 && (
            <div className='flex flex-wrap gap-2' role='group' aria-label='Fakulteta'>
              {faculties.map((f) => (
                <button
                  key={f.id}
                  className={`${chip(selected === f.id)} max-w-full`}
                  aria-pressed={selected === f.id}
                  onClick={() => {
                    setSelected(f.id);
                    setEditingSlot(null);
                  }}>
                  <span className='truncate'>{f.name}</span>
                </button>
              ))}
              <button className={chip(selected === 'new')} aria-pressed={selected === 'new'} onClick={() => setSelected('new')}>
                <Plus size={15} /> Nova fakulteta
              </button>
            </div>
          )}

          {!faculty && (
            <p className='max-w-prose text-sm text-muted-foreground'>
              Za fakulteto, ki urnika ne objavlja na Wise. Vpiši tedenske termine, Wiser jih ponovi
              vsak teden semestra in jih pokaže ob predmetih z Wise.
            </p>
          )}

          <FacultyForm
            key={faculty?.id ?? 'new'}
            faculty={faculty}
            commit={commit}
            onCreated={(id) => setSelected(id)}
            onDeleted={() => setSelected('new')}
          />

          {faculty && (
            <>
              <SubjectList faculty={faculty} commit={commit} />
              <SlotList faculty={faculty} commit={commit} editing={editingSlot} setEditing={setEditingSlot} />
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── Faculty: name, term, skipped dates ───────────────────────────────────────

function FacultyForm({
  faculty,
  commit,
  onCreated,
  onDeleted,
}: {
  faculty?: ManualFaculty;
  commit: Commit;
  onCreated: (id: number) => void;
  onDeleted: () => void;
}) {
  const initial: FacultyInput = faculty
    ? {name: faculty.name, termStart: faculty.termStart, termEnd: faculty.termEnd, skippedDates: faculty.skippedDates}
    : {name: '', termStart: '', termEnd: '', skippedDates: []};
  const [form, setForm] = useState(initial);
  const [skip, setSkip] = useState('');
  const {busy, errors, run} = useSubmit();
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const addSkip = () => {
    if (!skip || form.skippedDates.includes(skip)) return;
    setForm({...form, skippedDates: [...form.skippedDates, skip].sort()});
    setSkip('');
  };

  const slotCount = faculty?.subjects.reduce((n, s) => n + s.slots.length, 0) ?? 0;

  return (
    <section>
      <SectionTitle>Fakulteta</SectionTitle>
      <form
        className='space-y-3'
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            let createdId = 0;
            await commit(async (t) => {
              if (faculty) await updateManualFaculty(t, faculty.id, form);
              else createdId = (await createManualFaculty(t, form)).id;
            });
            if (!faculty) onCreated(createdId);
          });
        }}>
        <Field label='Ime' error={errors.name}>
          <input
            className={input}
            required
            maxLength={200}
            value={form.name}
            placeholder='npr. Fakultet islamskih nauka'
            aria-invalid={!!errors.name}
            onChange={(e) => setForm({...form, name: e.target.value})}
          />
        </Field>
        <div className='grid gap-3 sm:grid-cols-2'>
          <Field label='Začetek semestra' error={errors.termstart}>
            <input type='date' className={input} required value={form.termStart} aria-invalid={!!errors.termstart}
              onChange={(e) => setForm({...form, termStart: e.target.value})} />
          </Field>
          <Field label='Konec semestra' error={errors.termend}>
            <input type='date' className={input} required value={form.termEnd} aria-invalid={!!errors.termend}
              onChange={(e) => setForm({...form, termEnd: e.target.value})} />
          </Field>
        </div>

        <Field label='Dnevi brez pouka' error={errors.skippeddates}>
          <div className='flex gap-2'>
            <input type='date' className={input} value={skip} aria-label='Dan brez pouka'
              onChange={(e) => setSkip(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSkip();
                }
              }} />
            <button type='button' className={`${btnGhost} shrink-0`} onClick={addSkip} disabled={!skip}>
              <Plus size={15} /> Dodaj
            </button>
          </div>
          {form.skippedDates.length > 0 && (
            <ul className='mt-2 flex flex-wrap gap-1.5'>
              {form.skippedDates.map((d) => (
                <li key={d} className='inline-flex items-center gap-1 rounded bg-muted py-0.5 pl-2 pr-0.5 text-xs tabular-nums'>
                  {formatDate(d)}
                  <button type='button' className='rounded p-0.5 text-muted-foreground hover:text-foreground'
                    aria-label={`Odstrani ${formatDate(d)}`}
                    onClick={() => setForm({...form, skippedDates: form.skippedDates.filter((x) => x !== d)})}>
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Field>

        <FormError errors={errors} known={['name', 'termstart', 'termend', 'skippeddates']} />

        <div className='flex flex-wrap items-center justify-between gap-2'>
          {faculty ? (
            <ConfirmDelete
              label={`Izbriši ${faculty.name}`}
              prompt={slotCount ? `Izbrišem fakulteto in ${slotCount} ${plural(slotCount, 'termin', 'termina', 'termine', 'terminov')}?` : 'Izbrišem fakulteto?'}
              text='Izbriši fakulteto'
              onConfirm={() => run(async () => {
                await commit((t) => deleteManualFaculty(t, faculty.id));
                onDeleted();
              })}
            />
          ) : <span />}
          <button type='submit' className={btnPrimary} disabled={busy || (!!faculty && !dirty)}>
            {busy ? <Loader2 size={15} className='animate-spin' /> : <Check size={15} />}
            {faculty ? 'Shrani' : 'Ustvari fakulteto'}
          </button>
        </div>
      </form>
    </section>
  );
}

// ── Subjects ─────────────────────────────────────────────────────────────────

function SubjectList({faculty, commit}: {faculty: ManualFaculty; commit: Commit}) {
  const [name, setName] = useState('');
  const {busy, errors, run} = useSubmit();

  return (
    <section>
      <SectionTitle>Predmeti</SectionTitle>
      {faculty.subjects.length === 0 && (
        <p className='mb-2 text-sm text-muted-foreground'>Najprej dodaj predmete, nato njihove tedenske termine.</p>
      )}
      <ul className='mb-3 divide-y divide-border/60'>
        {faculty.subjects.map((s) => (
          <SubjectRow key={s.id} subject={s} commit={commit} />
        ))}
      </ul>
      <form
        className='flex gap-2'
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await commit((t) => createManualSubject(t, faculty.id, name.trim()));
            setName('');
          });
        }}>
        <input className={input} required maxLength={200} value={name} placeholder='Ime predmeta'
          aria-label='Ime novega predmeta' aria-invalid={!!errors.name}
          onChange={(e) => setName(e.target.value)} />
        <button type='submit' className={`${btnGhost} shrink-0`} disabled={busy || !name.trim()}>
          <Plus size={15} /> Dodaj predmet
        </button>
      </form>
      <FormError errors={errors} />
    </section>
  );
}

/** One subject. #7's per-subject group picker belongs in this row. */
function SubjectRow({subject, commit}: {subject: ManualSubject; commit: Commit}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(subject.name);
  const {busy, errors, run} = useSubmit();
  const n = subject.slots.length;

  if (renaming)
    return (
      <li className='py-2'>
        <form
          className='flex gap-2'
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await commit((t) => updateManualSubject(t, subject.id, name.trim()));
              setRenaming(false);
            });
          }}>
          <input className={input} autoFocus required maxLength={200} value={name} aria-label='Novo ime predmeta'
            aria-invalid={!!errors.name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setRenaming(false))} />
          <button type='submit' className={`${btnPrimary} shrink-0`} disabled={busy || !name.trim()}>Shrani</button>
          <button type='button' className={`${btnGhost} shrink-0`} onClick={() => setRenaming(false)}>Prekliči</button>
        </form>
        <FormError errors={errors} />
      </li>
    );

  return (
    <li className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5'>
      <span className='min-w-0 flex-1 basis-32'>
        <span className='block truncate text-sm font-medium'>{subject.name}</span>
        <span className='block text-xs text-muted-foreground'>
          {n} {plural(n, 'termin', 'termina', 'termini', 'terminov')}
        </span>
      </span>
      <span className='ml-auto flex shrink-0 items-center gap-1'>
        <button className={iconBtn} aria-label={`Preimenuj ${subject.name}`} title='Preimenuj'
          onClick={() => {
            setName(subject.name);
            setRenaming(true);
          }}>
          <Pencil size={15} />
        </button>
        <ConfirmDelete
          label={`Izbriši ${subject.name}`}
          prompt={n ? `Izbrišem predmet in ${n} ${plural(n, 'termin', 'termina', 'termine', 'terminov')}?` : 'Izbrišem predmet?'}
          onConfirm={() => run(() => commit((t) => deleteManualSubject(t, subject.id)))}
        />
      </span>
      <FormError errors={errors} />
    </li>
  );
}

// ── Weekly slots ─────────────────────────────────────────────────────────────

const slotGrid = 'grid grid-cols-[5.5rem_minmax(0,1fr)_auto] sm:grid-cols-[6.5rem_minmax(0,1.3fr)_3.5rem_3.5rem_minmax(0,1fr)_auto] items-center gap-x-3';

function SlotList({
  faculty,
  commit,
  editing,
  setEditing,
}: {
  faculty: ManualFaculty;
  commit: Commit;
  editing: number | 'new' | null;
  setEditing: (id: number | 'new' | null) => void;
}) {
  const rows = faculty.subjects
    .flatMap((subject) => subject.slots.map((slot) => ({slot, subject})))
    .sort((a, b) => a.slot.dayOfWeek - b.slot.dayOfWeek || a.slot.startTime.localeCompare(b.slot.startTime));

  return (
    <section>
      <div className='mb-2 flex items-center justify-between gap-2'>
        <SectionTitle className='mb-0'>Tedenski termini</SectionTitle>
        {faculty.subjects.length > 0 && editing !== 'new' && (
          <button className={btnGhost} onClick={() => setEditing('new')}>
            <Plus size={15} /> Dodaj termin
          </button>
        )}
      </div>

      {rows.length === 0 && editing !== 'new' && (
        <p className='text-sm text-muted-foreground'>
          {faculty.subjects.length ? 'Še ni terminov. Vsak termin se ponovi vsak teden semestra.' : 'Termine dodaš, ko imaš vsaj en predmet.'}
        </p>
      )}

      {rows.length > 0 && (
        <div className={`${slotGrid} hidden sm:grid border-b border-border/60 px-2 pb-1.5 text-xs font-medium text-muted-foreground`}>
          <span>Kdaj</span><span>Predmet</span><span>Vrsta</span><span>Skupina</span><span>Prostor · izvajalec</span><span className='w-[4.25rem]' />
        </div>
      )}

      <ul className='divide-y divide-border/60'>
        {rows.map(({slot, subject}) =>
          editing === slot.id ? (
            <li key={slot.id} className='py-2'>
              <SlotForm faculty={faculty} slot={slot} subjectId={subject.id} commit={commit} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <SlotRow key={slot.id} slot={slot} subject={subject} commit={commit} onEdit={() => setEditing(slot.id)} />
          ),
        )}
      </ul>

      {editing === 'new' && (
        <div className='mt-2'>
          <SlotForm faculty={faculty} commit={commit} onDone={() => setEditing(null)} />
        </div>
      )}
    </section>
  );
}

function SlotRow({slot, subject, commit, onEdit}: {slot: ManualSlot; subject: ManualSubject; commit: Commit; onEdit: () => void}) {
  const {errors, run} = useSubmit();
  const time = `${slot.startTime.slice(0, 5)}–${slot.endTime.slice(0, 5)}`;
  const place = [slot.room, slot.lecturer].filter(Boolean).join(' · ');
  return (
    <li className={`${slotGrid} rounded-md px-2 py-2 text-sm hover:bg-muted/40`}>
      <span className='tabular-nums'>
        <span className='block text-xs text-muted-foreground sm:inline sm:text-sm sm:text-foreground'>{DAYS_SHORT[slot.dayOfWeek - 1]}</span>{' '}
        <span className='block sm:inline'>{time}</span>
      </span>
      <span className='min-w-0'>
        <span className='block truncate font-medium'>{subject.name}</span>
        <span className='block truncate text-xs text-muted-foreground sm:hidden'>
          {[slot.type, slot.group && `sk. ${slot.group}`, place].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className='hidden truncate font-mono text-xs sm:block'>{slot.type}</span>
      <span className='hidden truncate text-xs sm:block'>{slot.group ?? '—'}</span>
      <span className='hidden truncate text-xs text-muted-foreground sm:block'>{place || '—'}</span>
      <span className='flex items-center justify-end gap-1'>
        <button className={iconBtn} aria-label={`Uredi ${subject.name} ${DAYS_SHORT[slot.dayOfWeek - 1]} ${time}`} title='Uredi' onClick={onEdit}>
          <Pencil size={15} />
        </button>
        <ConfirmDelete label={`Izbriši termin ${subject.name} ${time}`} prompt='Izbrišem?'
          onConfirm={() => run(() => commit((t) => deleteManualSlot(t, slot.id)))} />
      </span>
      {errors[''] && <span className='col-span-full'><FormError errors={errors} /></span>}
    </li>
  );
}

/** Add or edit one weekly slot. #8 opens this for a given slot via the editor's `focusSlotId`. */
function SlotForm({
  faculty,
  slot,
  subjectId,
  commit,
  onDone,
}: {
  faculty: ManualFaculty;
  slot?: ManualSlot;
  subjectId?: number;
  commit: Commit;
  onDone: () => void;
}) {
  const [subject, setSubject] = useState(subjectId ?? faculty.subjects[0]?.id ?? 0);
  const [form, setForm] = useState<SlotInput>({
    type: slot?.type ?? 'PR',
    group: slot?.group ?? '',
    dayOfWeek: slot?.dayOfWeek ?? 1,
    startTime: slot?.startTime.slice(0, 5) ?? '',
    endTime: slot?.endTime.slice(0, 5) ?? '',
    room: slot?.room ?? '',
    lecturer: slot?.lecturer ?? '',
  });
  const {busy, errors, run} = useSubmit();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({block: 'nearest'});
  }, []);
  const set = (patch: Partial<SlotInput>) => setForm({...form, ...patch});

  return (
    <form
      ref={ref}
      className='space-y-3 rounded-md border bg-muted/30 p-3'
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onDone();
        }
      }}
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await commit((t) => (slot ? updateManualSlot(t, slot.id, form) : createManualSlot(t, subject, form)));
          onDone();
        });
      }}>
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
        <Field label='Predmet' className='col-span-2'>
          {slot ? (
            <p className='py-2 text-sm font-medium'>{faculty.subjects.find((s) => s.id === subjectId)?.name}</p>
          ) : (
            <select className={input} value={subject} onChange={(e) => setSubject(Number(e.target.value))}>
              {faculty.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </Field>
        <Field label='Vrsta' error={errors.type}>
          <input className={input} autoFocus required maxLength={50} list='manual-slot-types' value={form.type}
            aria-invalid={!!errors.type} onChange={(e) => set({type: e.target.value})} />
        </Field>
        <Field label='Skupina' error={errors.group}>
          <input className={input} maxLength={50} value={form.group ?? ''} placeholder='vsi'
            onChange={(e) => set({group: e.target.value})} />
        </Field>
        <Field label='Dan' className='col-span-2' error={errors.dayofweek}>
          <select className={input} value={form.dayOfWeek} onChange={(e) => set({dayOfWeek: Number(e.target.value)})}>
            {DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
          </select>
        </Field>
        <Field label='Začetek' error={errors.starttime}>
          <input type='time' className={input} required value={form.startTime} aria-invalid={!!errors.starttime}
            onChange={(e) => set({startTime: e.target.value})} />
        </Field>
        <Field label='Konec' error={errors.endtime}>
          <input type='time' className={input} required value={form.endTime} aria-invalid={!!errors.endtime}
            onChange={(e) => set({endTime: e.target.value})} />
        </Field>
        <Field label='Prostor' className='col-span-2' error={errors.room}>
          <input className={input} maxLength={200} value={form.room ?? ''} onChange={(e) => set({room: e.target.value})} />
        </Field>
        <Field label='Izvajalec' className='col-span-2' error={errors.lecturer}>
          <input className={input} maxLength={200} value={form.lecturer ?? ''} onChange={(e) => set({lecturer: e.target.value})} />
        </Field>
      </div>
      <datalist id='manual-slot-types'>
        <option value='PR'>Predavanje</option>
        <option value='VJ'>Vaje</option>
        <option value='Praksa' />
      </datalist>
      <FormError errors={errors} known={['type', 'group', 'dayofweek', 'starttime', 'endtime', 'room', 'lecturer']} />
      <div className='flex justify-end gap-2'>
        <button type='button' className={btnGhost} onClick={onDone}>Prekliči</button>
        <button type='submit' className={btnPrimary} disabled={busy}>
          {busy ? <Loader2 size={15} className='animate-spin' /> : <Check size={15} />}
          {slot ? 'Shrani termin' : 'Dodaj termin'}
        </button>
      </div>
    </form>
  );
}

// ── Small parts ──────────────────────────────────────────────────────────────

/** Two-step delete: the trash button turns into an inline "really?" so nothing goes in one click. */
function ConfirmDelete({label, prompt, text, onConfirm}: {label: string; prompt: string; text?: string; onConfirm: () => void}) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <button type='button' className={text ? `${btn} text-rose-600 hover:bg-rose-500/10 dark:text-rose-400` : `${iconBtn} hover:text-rose-500`}
        aria-label={label} title={text ? undefined : 'Izbriši'} onClick={() => setAsking(true)}>
        <Trash2 size={15} />
        {text}
      </button>
    );
  return (
    <span className='inline-flex items-center gap-1 text-xs' role='group' aria-label={label}>
      <span className='text-rose-700 dark:text-rose-300'>{prompt}</span>
      <button type='button' autoFocus className='rounded-md bg-rose-600 px-2 py-1 text-white hover:bg-rose-700'
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}>
        Izbriši
      </button>
      <button type='button' className='rounded-md px-2 py-1 hover:bg-muted' onClick={() => setAsking(false)}>Ne</button>
    </span>
  );
}

function SectionTitle({children, className = 'mb-2'}: {children: React.ReactNode; className?: string}) {
  return <h4 className={`${className} text-xs font-medium uppercase tracking-wide text-muted-foreground`}>{children}</h4>;
}

function Field({label, error, className, children}: {label: string; error?: string; className?: string; children: React.ReactNode}) {
  return (
    <div className={className}>
      <label className='block'>
        <span className='mb-1 block text-xs text-muted-foreground'>{label}</span>
        {children}
      </label>
      {error && <p role='alert' className='mt-1 text-xs text-rose-600 dark:text-rose-400'>{error}</p>}
    </div>
  );
}

/** Errors no field claimed (network, 404, unknown fields), shown under the form. */
function FormError({errors, known = []}: {errors: Record<string, string>; known?: string[]}) {
  const rest = Object.entries(errors).filter(([k]) => !known.includes(k)).map(([, v]) => v);
  if (!rest.length) return null;
  return <p role='alert' className='mt-2 text-sm text-rose-600 dark:text-rose-400'>{rest.join(' ')}</p>;
}

function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErrors({});
    try {
      await fn();
    } catch (e) {
      setErrors(errorsOf(e));
    } finally {
      setBusy(false);
    }
  };
  return {busy, errors, run};
}

// The API answers in English and by property name; say it in the app's language instead.
const FIELD_MESSAGES: Record<string, string> = {
  name: 'Vpiši ime.',
  termstart: 'Vpiši veljaven datum začetka.',
  termend: 'Konec semestra ne sme biti pred začetkom.',
  type: 'Vpiši vrsto, npr. PR ali VJ.',
  dayofweek: 'Izberi dan v tednu.',
  starttime: 'Vpiši veljaven začetek.',
  endtime: 'Konec mora biti po začetku.',
  newstart: 'Vpiši veljaven začetek.',
  newend: 'Konec mora biti po začetku.',
  date: 'Ta termin na ta dan ne poteka več. Osveži urnik.',
};

function errorsOf(e: unknown): Record<string, string> {
  // "req" is ASP.NET's echo of a body it could not parse; the field-level entry says why.
  const fields = e instanceof ApiError ? Object.entries(e.fields).filter(([k]) => k !== 'req') : [];
  if (fields.length) return Object.fromEntries(fields.map(([k, v]) => [k, FIELD_MESSAGES[k] ?? v[0]]));
  return {'': messageOf(e)};
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError && e.status === 404) return 'Tega ni več. Zapri urejanje in ga odpri znova.';
  if (e instanceof ApiError && e.status === 401) return 'Prijava je potekla. Prijavi se znova.';
  const m = e instanceof Error ? e.message : String(e);
  return /failed to fetch|networkerror|\b5\d\d\b/i.test(m) ? 'Strežnik ni dosegljiv. Poskusi znova.' : m;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${Number(d)}. ${Number(m)}. ${y}`;
}

// ── One occurrence (opened from a class on the grid) ─────────────────────────

/** "2026-11-16" and "09:00" for a moment, in Ljubljana wall time like the API. */
const ljDate = (d: Date) => d.toLocaleDateString('sv-SE', {timeZone: 'Europe/Ljubljana'});
const ljTime = (d: Date) => d.toLocaleTimeString('sv-SE', {timeZone: 'Europe/Ljubljana', hour: '2-digit', minute: '2-digit'});

/**
 * Cancel, move or undo this one occurrence of a manual class, or jump to its weekly slot.
 * `onChanged` runs after a saved change so the grid refetches.
 */
export function OccurrenceActions({event, onChanged, onEditSlot}: {
  event: TimetableEvent;
  onChanged: () => void;
  onEditSlot: (slotId: number) => void;
}) {
  const {token} = useAuth();
  const {busy, errors, run} = useSubmit();
  const [moving, setMoving] = useState(false);
  const [move, setMove] = useState(() => ({
    date: ljDate(event.startAt),
    start: ljTime(event.startAt),
    end: ljTime(event.finishAt),
    room: event.roomName,
  }));
  const slotId = event.slotId!;
  const date = event.occurrenceDate!;
  const changed = event.status !== 'scheduled';

  const save = (call: (token: string) => Promise<unknown>) =>
    run(async () => {
      if (!token) throw new Error('Prijava je potekla. Prijavi se znova.');
      await call(token);
      onChanged();
    });

  return (
    <section className='space-y-3 border-t pt-4' aria-label='Ta termin'>
      {changed && (
        <p className='flex items-center gap-2 text-sm text-muted-foreground'>
          {event.status === 'cancelled' ? <CalendarX2 size={16} /> : <CalendarClock size={16} />}
          {event.status === 'cancelled'
            ? `Odpovedano za ${formatDate(date)}.`
            : `Prestavljeno s ${formatDate(date)}.`}
        </p>
      )}

      {moving ? (
        <form
          className='space-y-3 rounded-md border bg-muted/30 p-3'
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setMoving(false);
            }
          }}
          onSubmit={(e) => {
            e.preventDefault();
            save((t) => putSlotException(t, slotId, date, {
              kind: 'moved',
              newStart: `${move.date}T${move.start}:00`,
              newEnd: `${move.date}T${move.end}:00`,
              newRoom: move.room || null,
            }));
          }}>
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
            <Field label='Nov datum' className='col-span-2'>
              <input type='date' className={input} required autoFocus value={move.date}
                onChange={(e) => setMove({...move, date: e.target.value})} />
            </Field>
            <Field label='Začetek' error={errors.newstart}>
              <input type='time' className={input} required value={move.start} aria-invalid={!!errors.newstart}
                onChange={(e) => setMove({...move, start: e.target.value})} />
            </Field>
            <Field label='Konec' error={errors.newend}>
              <input type='time' className={input} required value={move.end} aria-invalid={!!errors.newend}
                onChange={(e) => setMove({...move, end: e.target.value})} />
            </Field>
            <Field label='Prostor' className='col-span-2 sm:col-span-4' error={errors.newroom}>
              <input className={input} maxLength={200} value={move.room} onChange={(e) => setMove({...move, room: e.target.value})} />
            </Field>
          </div>
          <FormError errors={errors} known={['newstart', 'newend', 'newroom']} />
          <div className='flex justify-end gap-2'>
            <button type='button' className={btnGhost} onClick={() => setMoving(false)}>Prekliči</button>
            <button type='submit' className={btnPrimary} disabled={busy}>
              {busy ? <Loader2 size={15} className='animate-spin' /> : <Check size={15} />}
              Prestavi
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className='flex flex-wrap items-center gap-2'>
            {event.status !== 'cancelled' && (
              <button type='button' className={btnGhost} disabled={busy}
                onClick={() => save((t) => putSlotException(t, slotId, date, {kind: 'cancelled'}))}>
                <CalendarX2 size={15} /> Odpovej ta termin
              </button>
            )}
            <button type='button' className={btnGhost} disabled={busy} onClick={() => setMoving(true)}>
              <CalendarClock size={15} /> {event.status === 'moved' ? 'Prestavi drugam' : 'Prestavi ta termin'}
            </button>
            {changed && (
              <button type='button' className={btnGhost} disabled={busy}
                onClick={() => save((t) => deleteSlotException(t, slotId, date))}>
                <Undo2 size={15} /> {event.status === 'cancelled' ? 'Razveljavi odpoved' : 'Razveljavi prestavitev'}
              </button>
            )}
            <button type='button' className={`${btn} text-muted-foreground hover:bg-muted hover:text-foreground sm:ml-auto`}
              onClick={() => onEditSlot(slotId)}>
              <Pencil size={15} /> Uredi tedenski termin
            </button>
            {busy && <Loader2 size={15} className='animate-spin text-muted-foreground' aria-label='Shranjujem' />}
          </div>
          <FormError errors={errors} />
        </>
      )}
    </section>
  );
}

/** Slovene has four number forms: 1, 2, 3–4, 5+. */
function plural(n: number, one: string, two: string, few: string, many: string) {
  const r = n % 100;
  return r === 1 ? one : r === 2 ? two : r === 3 || r === 4 ? few : many;
}
