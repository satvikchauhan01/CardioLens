// A short guided tour of the Analysis page: one part of the page is lit at a time, with a note
// beside it. It only points and explains; nothing on the page is changed by it.

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { TOUR_BACK, TOUR_DONE, TOUR_LABEL, TOUR_NEXT, TOUR_SKIP, TOUR_STEPS, tourProgress } from "../../config/copy";
import { usePrefersReducedMotion } from "../../utils/environment";
import { BUTTON_CLASS, PRIMARY_BUTTON_CLASS } from "../common/Feedback";

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const NOTE_WIDTH = 320;
const NOTE_HEIGHT = 250; // room kept for the note; its real height follows its text
const GAP = 16;
const MARGIN = 12;
const HALO = 6; // the lit area is this much larger than the part it shows

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), Math.max(low, high));

/**
 * Where the note goes: beside the lit part if there is room, else below or above it, else at the
 * bottom of the window. Always in pixels: the note's entry animation uses `transform`, so the
 * note must not be centred with it.
 */
function placeNote(box: Box | null): CSSProperties {
  const { innerWidth: width, innerHeight: height } = window;
  const noteWidth = Math.min(NOTE_WIDTH, width - 2 * MARGIN);
  const centred = Math.max(MARGIN, (width - noteWidth) / 2);
  if (!box) return { width: noteWidth, left: centred, top: Math.max(MARGIN, (height - NOTE_HEIGHT) / 2) };
  const top = clamp(box.top, MARGIN, height - NOTE_HEIGHT - MARGIN);
  const left = clamp(box.left, MARGIN, width - noteWidth - MARGIN);
  if (box.left + box.width + GAP + noteWidth + MARGIN <= width) return { width: noteWidth, top, left: box.left + box.width + GAP };
  if (box.left - GAP - noteWidth - MARGIN >= 0) return { width: noteWidth, top, left: box.left - GAP - noteWidth };
  if (box.top + box.height + GAP + NOTE_HEIGHT + MARGIN <= height) return { width: noteWidth, top: box.top + box.height + GAP, left };
  if (box.top - GAP - NOTE_HEIGHT - MARGIN >= 0) return { width: noteWidth, top: box.top - GAP - NOTE_HEIGHT, left };
  return { width: noteWidth, bottom: MARGIN, left: centred };
}

interface TourProps {
  open: boolean;
  onClose: () => void;
}

export function Tour({ open, onClose }: TourProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const note = useRef<HTMLDivElement>(null);
  const step = TOUR_STEPS[index];
  const last = index === TOUR_STEPS.length - 1;

  // Every tour starts at its first step, and gives the focus back to where it was when it ends.
  useEffect(() => {
    if (!open) return;
    setIndex(0);
    const opener = document.activeElement as HTMLElement | null;
    return () => opener?.focus?.();
  }, [open]);

  // Finds the part of the page this step is about, brings it into view and follows it while the
  // page scrolls, resizes or fills in. A part that is not on the page gets a note without a light.
  useLayoutEffect(() => {
    if (!open) return;
    const find = () => {
      const element = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      return element && element.getClientRects().length > 0 ? element : null;
    };
    const measure = () => {
      const rect = find()?.getBoundingClientRect();
      setBox(rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null);
    };
    const part = find();
    // A part taller than the window is shown from its top; a smaller one in the middle.
    const block = part && part.getBoundingClientRect().height > window.innerHeight * 0.8 ? "start" : "center";
    part?.scrollIntoView?.({ block, behavior: reducedMotion ? "auto" : "smooth" });
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(document.body);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      observer?.disconnect();
    };
  }, [open, step.target, reducedMotion]);

  useEffect(() => {
    if (open) note.current?.focus();
  }, [open, index]);

  if (!open) return null;

  const next = () => (last ? onClose() : setIndex(index + 1));
  const back = () => setIndex(Math.max(0, index - 1));

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") onClose();
    else if (event.key === "ArrowRight") next();
    else if (event.key === "ArrowLeft") back();
    else if (event.key === "Tab") {
      // The page behind is covered, so the focus stays within the note.
      const buttons = Array.from(note.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const target = buttons[(current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length];
      event.preventDefault();
      target?.focus();
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50" onKeyDown={handleKeyDown}>
      {box ? (
        <div
          aria-hidden="true"
          data-tour-light={step.target}
          className="absolute rounded-xl ring-2 ring-brand transition-all duration-300 motion-reduce:transition-none"
          style={{
            top: box.top - HALO,
            left: box.left - HALO,
            width: box.width + 2 * HALO,
            height: box.height + 2 * HALO,
            boxShadow: "0 0 0 200vmax rgb(2 6 23 / 0.6)",
          }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-[rgb(2_6_23/0.6)]" />
      )}
      <div
        ref={note}
        role="dialog"
        aria-modal="true"
        aria-label={TOUR_LABEL}
        aria-describedby="tour-text"
        tabIndex={-1}
        className="absolute animate-pop rounded-xl border border-line bg-surface p-4 shadow-xl outline-none motion-reduce:animate-none"
        style={placeNote(box)}
      >
        <p className="text-xs font-medium text-ink-muted">{tourProgress(index + 1, TOUR_STEPS.length)}</p>
        <h2 className="mt-1 text-base font-semibold text-ink">{step.title}</h2>
        <p id="tour-text" className="mt-1.5 text-sm text-ink-muted">
          {step.text}
        </p>
        <div aria-hidden="true" className="mt-3 flex gap-1">
          {TOUR_STEPS.map((item, position) => (
            <span
              key={item.target}
              className={`h-1 flex-1 rounded-full ${position <= index ? "bg-brand" : "bg-line"}`}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-md px-1 text-xs font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            {TOUR_SKIP}
          </button>
          <span className="flex gap-2">
            <button type="button" onClick={back} disabled={index === 0} className={`${BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}>
              {TOUR_BACK}
            </button>
            <button type="button" onClick={next} className={PRIMARY_BUTTON_CLASS}>
              {last ? TOUR_DONE : TOUR_NEXT}
            </button>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
