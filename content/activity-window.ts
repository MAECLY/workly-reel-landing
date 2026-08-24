import {
  MAX_INCLUSIVE_DAY_COUNT,
  MIN_INCLUSIVE_DAY_COUNT,
  buildActivityWindow,
  inclusiveDayCount,
  isWeekend,
  rangeForKind,
} from '@maecly/workly-reel-ui/domain';
import type { ActivityWindowKind, CalendarDate } from '@maecly/workly-reel-ui/domain';
import type { WindowMode, WindowRefusal } from './types';

/**
 * The Day / Week / Custom Range rules, derived rather than described.
 *
 * Every range and every refusal message below comes from the shipped
 * `buildActivityWindow` contract in the design system's `/domain` entry point,
 * which is the presentational half of an invariant the Rust domain layer
 * enforces independently. That entry point is pure and has no React and no
 * browser API, so a server component may call it. If the rule changes, this
 * copy changes with it instead of quietly going stale.
 */

/** The date the two screenshots were taken on, so page and picture agree. */
const ANCHOR: CalendarDate = '2026-08-24';
const TIMEZONE = 'America/Bogota';

const rangeFor = (kind: ActivityWindowKind): { startDate: CalendarDate; endDate: CalendarDate } => {
  const range = rangeForKind(kind, ANCHOR);
  if (range === null) {
    throw new Error(`rangeForKind refused ${kind} for ${ANCHOR}`);
  }
  return range;
};

const dayCountFor = (startDate: CalendarDate, endDate: CalendarDate): number => {
  const count = inclusiveDayCount(startDate, endDate);
  if (count === null) {
    throw new Error(`inclusiveDayCount refused ${startDate}..${endDate}`);
  }
  return count;
};

const day = rangeFor('day');
const week = rangeFor('week');
/** Friday to Monday: three of its four dates, and both weekend dates, count. */
const custom = { startDate: '2026-08-21' as CalendarDate, endDate: '2026-08-24' as CalendarDate };

const refusalFor = (
  attempt: string,
  input: Parameters<typeof buildActivityWindow>[0],
): WindowRefusal => {
  const result = buildActivityWindow(input);
  if (result.ok) {
    throw new Error(`buildActivityWindow accepted "${attempt}", which this page claims it refuses`);
  }
  return { attempt, code: result.error.code, message: result.error.message };
};

export const activityWindow = {
  eyebrow: 'The activity window',
  heading: 'One to seven days, and no argument about which ones.',
  standfirst:
    'The window is the first decision and the one every later artefact is bound to. Day is one date. Week is seven consecutive dates. Custom Range is one to seven inclusive dates. Weekends count as ordinary dates, and future dates are disabled.',
  timezoneNote: `Boundaries are resolved in your timezone, ${TIMEZONE} in these examples, and a day count is whole calendar dates rather than elapsed hours, so a daylight-saving change cannot move the answer.`,
  bounds: {
    min: MIN_INCLUSIVE_DAY_COUNT,
    max: MAX_INCLUSIVE_DAY_COUNT,
  },
  modes: [
    {
      name: 'Day',
      rule: 'Exactly one date.',
      startDate: day.startDate,
      endDate: day.endDate,
      dayCount: dayCountFor(day.startDate, day.endDate),
      note: 'Start and end are the same date.',
    },
    {
      name: 'Week',
      rule: 'Seven consecutive dates ending on the date you pick.',
      startDate: week.startDate,
      endDate: week.endDate,
      dayCount: dayCountFor(week.startDate, week.endDate),
      note: 'Always seven, never five. A calendar week is not a working week.',
    },
    {
      name: 'Custom Range',
      rule: 'One to seven inclusive dates, both ends included.',
      startDate: custom.startDate,
      endDate: custom.endDate,
      dayCount: dayCountFor(custom.startDate, custom.endDate),
      note: 'Friday to Monday. The Saturday and the Sunday inside it are selectable like any other date.',
    },
  ] as const satisfies readonly WindowMode[],
  weekendProof: {
    heading: 'Weekends count',
    body: 'Saturday and Sunday are ordinary selectable dates. Nothing skips them, and nothing marks a weekend as a gap in the record.',
    dates: [
      { date: '2026-08-22' as CalendarDate, label: 'Saturday', weekend: isWeekend('2026-08-22') },
      { date: '2026-08-23' as CalendarDate, label: 'Sunday', weekend: isWeekend('2026-08-23') },
    ],
  },
  refusalsHeading: 'What it refuses, in its own words',
  refusalsNote: 'These are the real messages the shipped contract returns, not a summary of them.',
  refusals: [
    refusalFor('A range of eight dates', {
      kind: 'custom',
      startDate: '2026-08-17',
      endDate: '2026-08-24',
      timezone: TIMEZONE,
      today: ANCHOR,
    }),
    refusalFor('Tomorrow', {
      kind: 'day',
      startDate: '2026-08-25',
      endDate: '2026-08-25',
      timezone: TIMEZONE,
      today: ANCHOR,
    }),
    refusalFor('An end date before its start date', {
      kind: 'custom',
      startDate: '2026-08-24',
      endDate: '2026-08-20',
      timezone: TIMEZONE,
      today: ANCHOR,
    }),
    refusalFor('A Week that spans five dates', {
      kind: 'week',
      startDate: '2026-08-20',
      endDate: '2026-08-24',
      timezone: TIMEZONE,
      today: ANCHOR,
    }),
  ] as const satisfies readonly WindowRefusal[],
} as const;
