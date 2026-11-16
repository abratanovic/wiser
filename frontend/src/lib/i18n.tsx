import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { TimetableEventType } from "@/types/TimetableEventType";

export type Locale = "en" | "sl";

type Dict = {
  common: {
    select: string;
    manageFilters: string;
    save: string;
    cancel: string;
    clear: string;
    clearAll: string;
    selectAll: string;
    searchSubjectsPlaceholder: string;
    pickGroupsHelper: string;
    noSubjectsMatch: string;
    loadingTimetable: string;
    manageFiltersTitle: string;
    noEventSelected: string;
    themeLight: string;
    themeDark: string;
    switchToLight: string;
    switchToDark: string;
    disclaimerPrefix: string;
    timetable: string;
    disclaimerSuffix: string;
    builtBy: string;
    latestCheckLabel: string;
    staleDataWarning: string;
    selectYearAndProject: string;
    selectProject: string;
  };
  header: {
    showBy: string;
    day: string;
    week: string;
    weekLabel: string;
    year: string;
    project: string;
  };
  auth: {
    login: string;
    loginSubtitle: string;
    register: string;
    registerSubtitle: string;
    continueWithGoogle: string;
    or: string;
    name: string;
    namePlaceholder: string;
    email: string;
    password: string;
    passwordHint: string;
    confirmPassword: string;
    continue: string;
    signingIn: string;
    creatingAccount: string;
    noAccount: string;
    signUp: string;
    haveAccount: string;
    signIn: string;
    continueAsGuest: string;
    signedOutTitle: string;
    signedOutBody: string;
    signInFailed: string;
  };
  details: {
    type: string;
    time: string;
    instructor: string;
    room: string;
    group: string;
    faculty: string;
    cancelled: string;
    moved: string;
  };
  types: Record<TimetableEventType, string>;
  manual: typeof slManual;
  locale: string; // for Intl formatting
};

/** Slovene has four number forms: 1, 2, 3–4, 5+. */
function plural(n: number, one: string, two: string, few: string, many: string) {
  const r = n % 100;
  return r === 1 ? one : r === 2 ? two : r === 3 || r === 4 ? few : many;
}

// The manual-faculty editor. Its shape is the type every locale must fill.
const slManual = {
  title: "Fakultete brez Wise",
  openEditor: "Fakulteta brez Wise? Vpiši njen urnik",
  close: "Zapri",
  loading: "Nalagam…",
  faculty: "Fakulteta",
  newFaculty: "Nova fakulteta",
  intro:
    "Za fakulteto, ki urnika ne objavlja na Wise. Vpiši tedenske termine, Wiser jih ponovi vsak teden semestra in jih pokaže ob predmetih z Wise.",
  name: "Ime",
  namePlaceholder: "npr. Fakultet islamskih nauka",
  termStart: "Začetek semestra",
  termEnd: "Konec semestra",
  skippedDates: "Dnevi brez pouka",
  skippedDate: "Dan brez pouka",
  add: "Dodaj",
  remove: (what: string) => `Odstrani ${what}`,
  deleteNamed: (what: string) => `Izbriši ${what}`,
  deleteFaculty: "Izbriši fakulteto",
  deleteFacultyPrompt: (slots: number) =>
    slots ? `Izbrišem fakulteto in ${slots} ${plural(slots, "termin", "termina", "termine", "terminov")}?` : "Izbrišem fakulteto?",
  createFaculty: "Ustvari fakulteto",
  subjects: "Predmeti",
  subjectsEmpty: "Najprej dodaj predmete, nato njihove tedenske termine.",
  subjectName: "Ime predmeta",
  newSubjectName: "Ime novega predmeta",
  renamedSubjectName: "Novo ime predmeta",
  addSubject: "Dodaj predmet",
  slotCount: (n: number) => `${n} ${plural(n, "termin", "termina", "termini", "terminov")}`,
  rename: "Preimenuj",
  renameNamed: (what: string) => `Preimenuj ${what}`,
  deleteSubjectPrompt: (slots: number) =>
    slots ? `Izbrišem predmet in ${slots} ${plural(slots, "termin", "termina", "termine", "terminov")}?` : "Izbrišem predmet?",
  groupFor: (subject: string) => `Skupina za ${subject}`,
  myGroup: "Moja skupina",
  allGroups: "Vse",
  weeklySlots: "Tedenski termini",
  addSlot: "Dodaj termin",
  slotsEmpty: "Še ni terminov. Vsak termin se ponovi vsak teden semestra.",
  slotsNeedSubject: "Termine dodaš, ko imaš vsaj en predmet.",
  when: "Kdaj",
  subject: "Predmet",
  type: "Vrsta",
  group: "Skupina",
  groupShort: (group: string) => `sk. ${group}`,
  groupPlaceholder: "vsi",
  roomAndLecturer: "Prostor · izvajalec",
  edit: "Uredi",
  editNamed: (what: string) => `Uredi ${what}`,
  deleteSlotNamed: (what: string) => `Izbriši termin ${what}`,
  deletePrompt: "Izbrišem?",
  delete: "Izbriši",
  no: "Ne",
  day: "Dan",
  start: "Začetek",
  end: "Konec",
  room: "Prostor",
  lecturer: "Izvajalec",
  saveSlot: "Shrani termin",
  days: ["Ponedeljek", "Torek", "Sreda", "Četrtek", "Petek", "Sobota", "Nedelja"],
  daysShort: ["Pon", "Tor", "Sre", "Čet", "Pet", "Sob", "Ned"],
  thisOccurrence: "Ta termin",
  cancelledOn: (date: string) => `Odpovedano za ${date}.`,
  movedFrom: (date: string) => `Prestavljeno s ${date}.`,
  newDate: "Nov datum",
  move: "Prestavi",
  cancelOccurrence: "Odpovej ta termin",
  moveOccurrence: "Prestavi ta termin",
  moveElsewhere: "Prestavi drugam",
  undoCancel: "Razveljavi odpoved",
  undoMove: "Razveljavi prestavitev",
  editWeeklySlot: "Uredi tedenski termin",
  saving: "Shranjujem",
  gone: "Tega ni več. Zapri urejanje in ga odpri znova.",
  sessionExpired: "Prijava je potekla. Prijavi se znova.",
  unreachable: "Strežnik ni dosegljiv. Poskusi znova.",
  // The API answers in English and by property name (lower-cased); say it in the app's language instead.
  fieldErrors: {
    name: "Vpiši ime.",
    termstart: "Vpiši veljaven datum začetka.",
    termend: "Konec semestra ne sme biti pred začetkom.",
    type: "Vpiši vrsto, npr. PR ali VJ.",
    dayofweek: "Izberi dan v tednu.",
    starttime: "Vpiši veljaven začetek.",
    endtime: "Konec mora biti po začetku.",
    newstart: "Vpiši veljaven začetek.",
    newend: "Konec mora biti po začetku.",
    date: "Ta termin na ta dan ne poteka več. Osveži urnik.",
    pickedgroup: "Predmet nima termina v tej skupini.",
  } as Record<string, string>,
};

const enSlots = (n: number) => `${n} ${n === 1 ? "slot" : "slots"}`;

const dicts: Record<Locale, Dict> = {
  en: {
    common: {
      select: "Select",
      manageFilters: "Manage filters",
      save: "Save",
      cancel: "Cancel",
      clear: "Clear",
      clearAll: "Clear all",
      selectAll: "Select all",
      searchSubjectsPlaceholder: "Search subjects…",
      pickGroupsHelper:
        "Pick your groups per subject. Keep it simple — adjust anytime.",
      noSubjectsMatch: "No subjects match your search.",
      loadingTimetable: "Loading timetable…",
      manageFiltersTitle: "Manage filters",
      noEventSelected: "No event selected.",
      themeLight: "Light",
      themeDark: "Dark",
      switchToLight: "Switch to light mode",
      switchToDark: "Switch to dark mode",
      disclaimerPrefix: "Timetable data comes from the",
      timetable: "timetable of UM FERI.",
      disclaimerSuffix:
        "An independent student project, not affiliated with Wise Technologies or the faculty. Always check the official timetable before you rely on it.",
      builtBy: "Built by",
      latestCheckLabel: "Latest check",
      staleDataWarning: "Data might not be up to date. Last update was more than 30 minutes ago.",
      selectYearAndProject: "Select a year and project to view the timetable.",
      selectProject: "Select a project to view the timetable.",
    },
    header: {
      showBy: "Show by:",
      day: "Day",
      week: "Week",
      weekLabel: "Week",
      year: "Year",
      project: "Project",
    },
    auth: {
      login: "Log in",
      loginSubtitle: "Welcome back. Sign in to continue.",
      register: "Create an account",
      registerSubtitle: "Get started for free.",
      continueWithGoogle: "Continue with Google",
      or: "or",
      name: "Name",
      namePlaceholder: "Your name",
      email: "Email",
      password: "Password",
      passwordHint: "Uppercase, lowercase, number & special character",
      confirmPassword: "Confirm password",
      continue: "Continue",
      signingIn: "Signing in…",
      creatingAccount: "Creating account…",
      noAccount: "No account?",
      signUp: "Sign up",
      haveAccount: "Already have an account?",
      signIn: "Log in",
      continueAsGuest: "Continue as guest →",
      signedOutTitle: "You are not signed in",
      signedOutBody:
        "If you have already built a timetable, it is saved to your account — sign in to bring it to this device. Installing the app from the home screen starts it signed out, because it keeps its own storage, separate from the browser.",
      signInFailed: "Sign-in did not complete. Please try again.",
    },
    details: {
      type: "Type",
      time: "Time",
      instructor: "Instructor",
      room: "Room",
      group: "Group",
      faculty: "Faculty",
      cancelled: "cancelled",
      moved: "moved",
    },
    types: {
      Lecture: "Lecture",
      Tutorial: "Tutorial",
      Lab: "Lab",
      LabExercise: "Lab exercise",
      Seminar: "Seminar",
      SeminarExercise: "Seminar exercise",
      Exercise: "Exercise",
      Exam: "Exam",
      Consultation: "Consultation",
      ComputerExercise: "Computer exercise",
    },
    manual: {
      title: "Faculties without Wise",
      openEditor: "Faculty not on Wise? Enter its timetable",
      close: "Close",
      loading: "Loading…",
      faculty: "Faculty",
      newFaculty: "New faculty",
      intro:
        "For a faculty that does not publish its timetable on Wise. Enter the weekly slots; Wiser repeats them every week of the term and shows them alongside your Wise subjects.",
      name: "Name",
      namePlaceholder: "e.g. Fakultet islamskih nauka",
      termStart: "Term start",
      termEnd: "Term end",
      skippedDates: "Days without classes",
      skippedDate: "Day without classes",
      add: "Add",
      remove: (what) => `Remove ${what}`,
      deleteNamed: (what) => `Delete ${what}`,
      deleteFaculty: "Delete faculty",
      deleteFacultyPrompt: (n) => (n ? `Delete the faculty and its ${enSlots(n)}?` : "Delete the faculty?"),
      createFaculty: "Create faculty",
      subjects: "Subjects",
      subjectsEmpty: "Add subjects first, then their weekly slots.",
      subjectName: "Subject name",
      newSubjectName: "New subject name",
      renamedSubjectName: "New name for the subject",
      addSubject: "Add subject",
      slotCount: enSlots,
      rename: "Rename",
      renameNamed: (what) => `Rename ${what}`,
      deleteSubjectPrompt: (n) => (n ? `Delete the subject and its ${enSlots(n)}?` : "Delete the subject?"),
      groupFor: (subject) => `Group for ${subject}`,
      myGroup: "My group",
      allGroups: "All",
      weeklySlots: "Weekly slots",
      addSlot: "Add slot",
      slotsEmpty: "No slots yet. Each slot repeats every week of the term.",
      slotsNeedSubject: "You can add slots once you have at least one subject.",
      when: "When",
      subject: "Subject",
      type: "Type",
      group: "Group",
      groupShort: (group) => `gr. ${group}`,
      groupPlaceholder: "all",
      roomAndLecturer: "Room · lecturer",
      edit: "Edit",
      editNamed: (what) => `Edit ${what}`,
      deleteSlotNamed: (what) => `Delete slot ${what}`,
      deletePrompt: "Delete?",
      delete: "Delete",
      no: "No",
      day: "Day",
      start: "Start",
      end: "End",
      room: "Room",
      lecturer: "Lecturer",
      saveSlot: "Save slot",
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      daysShort: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      thisOccurrence: "This class",
      cancelledOn: (date) => `Cancelled for ${date}.`,
      movedFrom: (date) => `Moved from ${date}.`,
      newDate: "New date",
      move: "Move",
      cancelOccurrence: "Cancel this class",
      moveOccurrence: "Move this class",
      moveElsewhere: "Move elsewhere",
      undoCancel: "Undo cancellation",
      undoMove: "Undo move",
      editWeeklySlot: "Edit weekly slot",
      saving: "Saving",
      gone: "This no longer exists. Close the editor and open it again.",
      sessionExpired: "Your session has expired. Please sign in again.",
      unreachable: "Cannot reach the server. Please try again.",
      fieldErrors: {
        name: "Enter a name.",
        termstart: "Enter a valid start date.",
        termend: "The term cannot end before it starts.",
        type: "Enter a type, e.g. PR or VJ.",
        dayofweek: "Pick a day of the week.",
        starttime: "Enter a valid start time.",
        endtime: "The end must be after the start.",
        newstart: "Enter a valid start time.",
        newend: "The end must be after the start.",
        date: "This slot no longer takes place on that day. Refresh the timetable.",
        pickedgroup: "The subject has no slot in this group.",
      },
    },
    locale: "en-GB",
  },
  sl: {
    common: {
      select: "Izberi",
      manageFilters: "Upravljaj filtre",
      save: "Shrani",
      cancel: "Prekliči",
      clear: "Počisti",
      clearAll: "Počisti vse",
      selectAll: "Izberi vse",
      searchSubjectsPlaceholder: "Išči predmete…",
      pickGroupsHelper:
        "Izberi svoje skupine za vsak predmet. Preprosto — lahko kadarkoli spremeniš.",
      noSubjectsMatch: "Noben predmet ne ustreza iskanju.",
      loadingTimetable: "Nalaganje urnika…",
      manageFiltersTitle: "Upravljanje filtrov",
      noEventSelected: "Ni izbranega dogodka.",
      themeLight: "Svetla",
      themeDark: "Temna",
      switchToLight: "Preklopi na svetlo temo",
      switchToDark: "Preklopi na temno temo",
      disclaimerPrefix: "Podatki prihajajo iz",
      timetable: "urnika UM FERI.",
      disclaimerSuffix:
        "Neodvisen študentski projekt, ki ni povezan s podjetjem Wise Technologies ali s fakulteto. Pred zanašanjem vedno preveri uradni urnik.",
      builtBy: "Ustvarila",
      latestCheckLabel: "Zadnji zajem",
      staleDataWarning: "Podatki morda niso najnovejši. Zadnja posodobitev je bila pred več kot 30 minutami.",
      selectYearAndProject: "Izberi letnik in smer za prikaz urnika.",
      selectProject: "Izberi smer za prikaz urnika.",
    },
    header: {
      showBy: "Prikaz:",
      day: "Dan",
      week: "Teden",
      weekLabel: "Teden",
      year: "Letnik",
      project: "Smer",
    },
    auth: {
      login: "Prijava",
      loginSubtitle: "Dobrodošli. Prijavite se za nadaljevanje.",
      register: "Ustvari račun",
      registerSubtitle: "Začnite brezplačno.",
      continueWithGoogle: "Nadaljuj z Google",
      or: "ali",
      name: "Ime",
      namePlaceholder: "Vaše ime",
      email: "E-pošta",
      password: "Geslo",
      passwordHint: "Velika, mala, številka in poseben znak",
      confirmPassword: "Potrdi geslo",
      continue: "Nadaljuj",
      signingIn: "Prijavljanje…",
      creatingAccount: "Ustvarjanje računa…",
      noAccount: "Nimaš računa?",
      signUp: "Registracija",
      haveAccount: "Že imaš račun?",
      signIn: "Prijava",
      continueAsGuest: "Nadaljuj kot gost →",
      signedOutTitle: "Niste prijavljeni",
      signedOutBody:
        "Če ste si urnik že sestavili, je shranjen v vašem računu — prijavite se, da ga prenesete na to napravo. Aplikacija, nameščena z začetnega zaslona, se zažene odjavljena, ker ima svojo shrambo, ločeno od brskalnika.",
      signInFailed: "Prijava ni bila zaključena. Poskusite znova.",
    },
    details: {
      type: "Vrsta",
      time: "Čas",
      instructor: "Predavatelj",
      room: "Prostor",
      group: "Skupina",
      faculty: "Fakulteta",
      cancelled: "odpovedano",
      moved: "prestavljeno",
    },
    types: {
      Lecture: "Predavanje",
      Tutorial: "Vaje",
      Lab: "Laboratorij",
      LabExercise: "Laboratorijske vaje",
      Seminar: "Seminar",
      SeminarExercise: "Seminarske vaje",
      Exercise: "Vaje",
      Exam: "Izpit",
      Consultation: "Govorilne ure",
      ComputerExercise: "Računalniške vaje",
    },
    manual: slManual,
    locale: "sl-SI",
  },
};

type Ctx = {
  locale: Locale;
  t: Dict;
  setLocale: (l: Locale) => void;
};

const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem("localeV2") || localStorage.getItem("localeV1");
      if (saved === "en" || saved === "sl") return saved;
    } catch {}
    return "sl";
  });

  useEffect(() => {
    try {
      localStorage.setItem("localeV2", locale);
    } catch {}
  }, [locale]);

  const value = useMemo<Ctx>(
    () => ({ locale, t: dicts[locale], setLocale }),
    [locale]
  );
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
