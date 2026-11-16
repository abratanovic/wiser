import { ljTimeFmt } from "@/Helpers/DateHelpers";
import type { LaidOut } from "@/types/LaidOut";
import { Clock, GraduationCap, MapPin, UsersRound, Tags } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getEventColors } from "@/constants/eventColors";
import { sourceDot, sourceLabel } from "@/lib/sources";

type TimetableEventBlockProps = {
  ev: LaidOut;
  leftPct: number;
  widthPct: number;
  /** Mark the class with its faculty; only worth the space when there is more than one. */
  showSource?: boolean;
  onClick?: (ev: LaidOut) => void;
};

export function TimetableEventBlock({
  ev,
  leftPct,
  widthPct,
  showSource,
  onClick,
}: TimetableEventBlockProps) {
  const { t } = useI18n();
  const c = getEventColors(ev.type);
  return (
    <div
      key={ev.id}
      className="absolute rounded-md p-1 font-inter cursor-pointer"
      style={{
        top: ev.__top,
        height: ev.__height,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
      }}
      title={`${ljTimeFmt.format(ev.startAt)}–${ljTimeFmt.format(ev.finishAt)}${
        showSource ? ` · ${ev.source.name}` : ""
      }`}
      onClick={() => onClick?.(ev)}
    >
      <div
        className={`w-full h-full p-1.5 sm:p-1.5 space-y-0.5 rounded-sm hover:brightness-95 transition-all overflow-hidden ${c.bg} ${c.text} ${c.darkBg} ${c.darkText}`}
      >
        <h2 className="text-sm sm:text-xs md:text-sm font-bold line-clamp-2 leading-tight">
          {ev.className}
        </h2>
        <div className="flex items-center gap-0.5 sm:gap-1 text-xs sm:text-xs font-medium truncate">
          {showSource ? (
            // The type colour already fills the block, so the faculty gets a dot and a short
            // tag of its own rather than a second colour fighting the first.
            <>
              <span
                aria-hidden
                className={`size-2 rounded-full flex-shrink-0 ring-1 ring-white/70 dark:ring-black/40 ${sourceDot(ev.source)}`}
              />
              <p className="truncate">
                <span className="font-bold tracking-wide">{sourceLabel(ev.source)}</span>
                <span className="sr-only"> ({ev.source.name})</span>
                {" · "}
                {t.types[ev.type]}
              </p>
            </>
          ) : (
            <>
              <Tags size={12} strokeWidth={1.5} className="flex-shrink-0" />
              <p className="truncate">{t.types[ev.type]}</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1 text-xs sm:text-xs font-light truncate">
          <Clock size={12} strokeWidth={1.5} className="flex-shrink-0" />
          <p className="truncate">
            {ljTimeFmt.format(ev.startAt)}–{ljTimeFmt.format(ev.finishAt)}
          </p>
        </div>
        {ev.type === "ComputerExercise" ? (
          <>
            <div className="hidden sm:flex items-center gap-1 text-xs font-light truncate">
              <UsersRound size={12} strokeWidth={1.5} className="flex-shrink-0" />
              <p className="truncate">{ev.groupName}</p>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1 text-xs font-light truncate">
              <MapPin size={12} strokeWidth={1.5} className="flex-shrink-0" />
              <p className="truncate">{ev.roomName}</p>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-xs font-light truncate">
              <GraduationCap size={12} strokeWidth={1.5} className="flex-shrink-0" />
              <p className="truncate">{ev.instructorName}</p>
            </div>
          </>
        ) : (
          <>
            <div className="hidden sm:flex items-center gap-1 text-xs font-light truncate">
              <GraduationCap size={12} strokeWidth={1.5} className="flex-shrink-0" />
              <p className="truncate">{ev.instructorName}</p>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1 text-xs font-light truncate">
              <MapPin size={12} strokeWidth={1.5} className="flex-shrink-0" />
              <p className="truncate">{ev.roomName}</p>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-xs font-light truncate">
              <UsersRound size={12} strokeWidth={1.5} className="flex-shrink-0" />
              <p className="truncate">{ev.groupName}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
