/**
 * Client for our own backend: authentication and the per-user timetable selections.
 *
 * Timetable data does not come through here — it comes from the Wise catalogue and schedule in
 * `@/lib/wiseApi`, which the backend proxies.
 */

import type {WiseSelection} from './wiseApi';

import {API_HOST} from './apiHost';

/**
 * Carries the HTTP status alongside the message. A caller that cannot tell 401 from 500 cannot
 * tell "your session ended" from "the server is unwell", and the difference decides whether the
 * right move is to sign the student out or to keep what is on screen and retry.
 */
export class ApiError extends Error {
  // Written out rather than declared as a constructor parameter property: the build runs with
  // `erasableSyntaxOnly`, which rejects the shorthand.
  readonly status: number;
  /** ASP.NET validation errors by field, keys lower-cased ("termend"); empty otherwise. */
  readonly fields: Record<string, string[]>;

  constructor(status: number, message: string, fields: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_HOST}${path}`, init);
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as {
      message?: string;
      errors?: Record<string, string[]>;
    };
    // A 400 from model validation carries `errors` keyed by property ("TermEnd", "$.startTime").
    const fields = Object.fromEntries(
      Object.entries(data.errors ?? {}).map(([k, v]) => [k.replace(/^\$\./, '').toLowerCase(), v]),
    );
    throw new ApiError(
      res.status,
      data.message || Object.values(fields)[0]?.[0] || `Request failed: ${res.status}`,
      fields,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function authHeaders(token: string, json = false): HeadersInit {
  return json
    ? {'Content-Type': 'application/json', Authorization: `Bearer ${token}`}
    : {Authorization: `Bearer ${token}`};
}

// ── Authentication ──────────────────────────────────────────────────────────
//
// Google sign-in is not here: it is a full-page trip to /auth/google and back, so it never goes
// through fetch — see AuthContext. These two are the email-and-password path, posted by the
// forms in the sign-in modal.

export function loginWithEmail(
  email: string,
  password: string,
): Promise<{token: string}> {
  return apiClient('/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email, password}),
  });
}

export function registerWithEmail(
  name: string,
  email: string,
  password: string,
): Promise<{token: string}> {
  return apiClient('/auth/register', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({name, email, password}),
  });
}

// ── Timetable selections ────────────────────────────────────────────────────

/**
 * Persisted shape of a signed-in student's timetable. The version tag matters: the same column
 * previously held the per-class group filter of the old BV20-only timetable, and a reader that
 * does not check `v` would hand that back as a list of selections.
 */
export type StoredSelections = {v: 2; selections: WiseSelection[]};

export function getStoredSelections(
  token: string,
): Promise<{groupFilters?: string}> {
  return apiClient('/user/filters', {headers: authHeaders(token)});
}

export function saveStoredSelections(
  token: string,
  selections: WiseSelection[],
): Promise<void> {
  const payload: StoredSelections = {v: 2, selections};
  return apiClient('/user/filters', {
    method: 'PUT',
    headers: authHeaders(token, true),
    body: JSON.stringify({groupFilters: JSON.stringify(payload)}),
  });
}

/** Approves a `wiser login` device code, signing that terminal in as this account. */
export function approveCliLogin(token: string, userCode: string): Promise<void> {
  return apiClient('/auth/cli/approve', {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({userCode}),
  });
}

// ── Manual faculties ────────────────────────────────────────────────────────

/** ISO day of week: 1 = Monday ... 7 = Sunday. Times are Ljubljana wall clock, "HH:mm:ss". */
export type ManualSlot = {
  id: number;
  subjectId: number;
  type: string;
  group: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  lecturer: string | null;
};

export type ManualSubject = {
  id: number;
  facultyId: number;
  name: string;
  pickedGroup: string | null;
  slots: ManualSlot[];
};

export type ManualFaculty = {
  id: number;
  name: string;
  termStart: string; // YYYY-MM-DD
  termEnd: string;
  skippedDates: string[];
  subjects: ManualSubject[];
};

export function getManualFaculties(token: string): Promise<ManualFaculty[]> {
  return apiClient('/api/manual-faculties', {headers: authHeaders(token)});
}

export type FacultyInput = Pick<ManualFaculty, 'name' | 'termStart' | 'termEnd' | 'skippedDates'>;
/** Times as "HH:mm"; empty group/room/lecturer are stored as null. */
export type SlotInput = Omit<ManualSlot, 'id' | 'subjectId'>;

const send = <T,>(token: string, method: string, path: string, body?: unknown): Promise<T> =>
  apiClient(`/api/manual-faculties${path}`, {
    method,
    headers: authHeaders(token, body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const createManualFaculty = (token: string, f: FacultyInput) =>
  send<ManualFaculty>(token, 'POST', '', f);
export const updateManualFaculty = (token: string, id: number, f: FacultyInput) =>
  send<ManualFaculty>(token, 'PUT', `/${id}`, f);
export const deleteManualFaculty = (token: string, id: number) =>
  send<void>(token, 'DELETE', `/${id}`);

export const createManualSubject = (token: string, facultyId: number, name: string) =>
  send<ManualSubject>(token, 'POST', `/${facultyId}/subjects`, {name});
export const updateManualSubject = (token: string, id: number, name: string) =>
  send<ManualSubject>(token, 'PUT', `/subjects/${id}`, {name});
export const deleteManualSubject = (token: string, id: number) =>
  send<void>(token, 'DELETE', `/subjects/${id}`);

export const createManualSlot = (token: string, subjectId: number, slot: SlotInput) =>
  send<ManualSlot>(token, 'POST', `/subjects/${subjectId}/slots`, slot);
export const updateManualSlot = (token: string, id: number, slot: SlotInput) =>
  send<ManualSlot>(token, 'PUT', `/slots/${id}`, slot);
export const deleteManualSlot = (token: string, id: number) =>
  send<void>(token, 'DELETE', `/slots/${id}`);
