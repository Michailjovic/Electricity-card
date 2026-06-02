import type { TariffDay } from './types.js';

export interface TariffPreset {
  label: string;
  weekday: TariffDay;
  weekend: TariffDay;
  holiday?: TariffDay;
}

/**
 * Pre-defined NT schedules for PRE distributor (Prague, Czech Republic).
 * Source: PRE — Program povelů HDO (aktuální ke 2026-06-02)
 * https://www.predistribuce.cz/cs/produkty-a-sluzby/zakaznici/produkty/hdo/
 */
export const PRE_TARIFFS: Record<string, TariffPreset> = {
  '600': {
    label: 'PRE 600 — D25d / D26d (appliance)',
    weekday: {
      starts:  ['00:40', '12:40'],
      offsets: [300,     180],
    },
    weekend: {
      starts:  ['02:40', '12:40'],
      offsets: [180,     300],
    },
    holiday: {
      starts:  ['00:40', '12:20'],
      offsets: [300,     180],
    },
  },

  '601': {
    label: 'PRE 601 — C45d (hot water / TUV)',
    weekday: {
      starts:  ['01:00', '04:40', '14:00'],
      offsets: [180,     120,     180],
    },
    weekend: {
      starts:  ['01:20', '11:00', '14:00'],
      offsets: [160,     140,     180],
    },
    holiday: {
      starts:  ['02:00', '06:40', '15:00'],
      offsets: [240,     80,      160],
    },
  },

  '605': {
    label: 'PRE 605 — D57d (main NT)',
    weekday: {
      starts:  ['01:40', '05:20', '10:00', '13:40', '18:20'],
      offsets: [180,     240,     180,     240,     180],
    },
    weekend: {
      starts:  ['02:40', '06:20', '10:00', '13:40', '19:20'],
      offsets: [180,     180,     180,     300,     180],
    },
    holiday: {
      starts:  ['02:20', '07:00', '11:40', '15:20', '19:00'],
      offsets: [240,     240,     180,     180,     180],
    },
  },

  '606': {
    label: 'PRE 606 — D57d (appliance)',
    weekday: {
      starts:  ['01:40', '05:20', '10:00', '13:40', '18:20'],
      offsets: [180,     240,     180,     240,     180],
    },
    weekend: {
      starts:  ['02:40', '06:20', '10:00', '13:40', '19:20'],
      offsets: [180,     180,     180,     300,     180],
    },
    holiday: {
      starts:  ['02:20', '07:00', '11:40', '15:20', '19:00'],
      offsets: [240,     240,     180,     180,     180],
    },
  },

  '607': {
    label: 'PRE 607 — D57d (hot water / TUV)',
    weekday: {
      starts:  ['01:40', '05:20', '13:40'],
      offsets: [180,     120,     180],
    },
    weekend: {
      starts:  ['03:00', '06:20', '13:40'],
      offsets: [160,     120,     200],
    },
    holiday: {
      starts:  ['02:20', '07:00', '15:20'],
      offsets: [240,     80,      160],
    },
  },
};
