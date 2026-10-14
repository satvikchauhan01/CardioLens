// The Home page: what CardioLens is, the heart with the estimates of the patient in analysis, and
// the ways into the app. Every number on it comes from the model service's metadata.

import type { SamplePatient } from "../../api/types";
import {
  HOME_EYEBROW,
  HOME_HEART_WAITING,
  HOME_OPEN,
  HOME_STATS_LABEL,
  HOME_STEPS,
  HOME_STEPS_HEADING,
  HOME_TEXT,
  HOME_TITLE,
  HOME_WAYS_HEADING,
  homeHeartCaption,
  homeStats,
  homeWays,
  OWN_PATIENT,
  TOUR_START,
  type TabId,
} from "../../config/copy";
import { HeroHeart } from "../../scene/HeroHeart";
import type { AnalysisState } from "../../state/analysisReducer";
import { useMeta } from "../../state/MetaContext";
import { BUTTON_CLASS, PRIMARY_BUTTON_CLASS } from "../common/Feedback";
import { Icon } from "../common/Icon";

interface HomeViewProps {
  samples: SamplePatient[];
  state: AnalysisState; // the analysis whose estimates colour the heart
  active: boolean;
  onNavigate: (tab: TabId) => void;
  onStartTour: () => void;
}

export function HomeView({ samples, state, active, onNavigate, onStartTour }: HomeViewProps) {
  const meta = useMeta();
  const shown = state.status === "ready" ? state.result : state.lastGoodResult;
  const sample = state.source === "sample" ? samples.find((candidate) => candidate.id === state.sampleId) : undefined;
  const patient = sample?.title ?? OWN_PATIENT;
  const withCad = samples.filter((candidate) => candidate.ground_truth.cad === 1).length;

  const stats = homeStats({
    models: meta.targets.length,
    inputs: meta.features.length,
    samples: samples.length,
    patients: meta.dataset.n_total,
  });
  const ways = homeWays({
    samples: samples.length,
    withCad,
    without: samples.length - withCad,
    inputs: meta.features.length,
  });

  return (
    <div className="space-y-8">
      <section
        aria-labelledby="home-title"
        className="grid items-center gap-8 rounded-2xl border border-line bg-surface p-6 shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:p-10"
      >
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full border border-line bg-accent-soft px-3 py-1 text-xs font-medium text-ink">
            <Icon name="heart" className="size-3.5 text-accent" />
            {HOME_EYEBROW}
          </p>
          <h2 id="home-title" className="mt-4 text-3xl font-semibold tracking-tight text-ink lg:text-4xl">
            {HOME_TITLE}
          </h2>
          <p className="mt-4 max-w-xl text-base text-ink-muted">{HOME_TEXT}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate("analysis")}
              className={`${PRIMARY_BUTTON_CLASS} inline-flex items-center gap-2 px-4 py-2`}
            >
              {HOME_OPEN}
              <Icon name="arrow" />
            </button>
            <button type="button" onClick={onStartTour} className={`${BUTTON_CLASS} inline-flex items-center gap-2 px-4 py-2`}>
              <Icon name="tour" />
              {TOUR_START}
            </button>
          </div>
        </div>
        <figure>
          <HeroHeart predictions={shown?.predictions ?? null} active={active} />
          <figcaption className="mt-2 text-center text-xs text-ink-muted">
            {shown ? homeHeartCaption(patient) : HOME_HEART_WAITING}
          </figcaption>
        </figure>
      </section>

      <section aria-label={HOME_STATS_LABEL}>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-line bg-surface p-4 shadow-sm">
              <dt className="flex items-center gap-2 text-sm font-medium text-ink-muted">
                <span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Icon name={stat.icon} className="size-4.5" />
                </span>
                {stat.label}
              </dt>
              <dd className="mt-2">
                <span className="block text-3xl font-semibold tracking-tight tabular-nums text-ink">{stat.value}</span>
                <span className="mt-1 block text-xs text-ink-muted">{stat.note}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="home-ways">
        <h2 id="home-ways" className="text-sm font-semibold text-ink">
          {HOME_WAYS_HEADING}
        </h2>
        <ul className="mt-3 grid gap-4 lg:grid-cols-3">
          {ways.map((way) => (
            <li key={way.tab}>
              <button
                type="button"
                onClick={() => onNavigate(way.tab)}
                className="group flex h-full w-full cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <Icon name={way.icon} className="size-5" />
                </span>
                <span>
                  <span className="flex items-center gap-1.5 text-base font-semibold text-ink">
                    {way.title}
                    <Icon name="arrow" className="size-4 text-brand transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </span>
                  <span className="mt-1 block text-sm text-ink-muted">{way.text}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="home-steps" className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <h2 id="home-steps" className="text-sm font-semibold text-ink">
          {HOME_STEPS_HEADING}
        </h2>
        <ol className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HOME_STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-surface"
              >
                {index + 1}
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">{step.title}</span>
                <span className="mt-0.5 block text-sm text-ink-muted">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
