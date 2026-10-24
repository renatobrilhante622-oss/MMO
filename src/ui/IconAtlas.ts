import type { ClassId } from '../core/GameTypes';

/** Small authored vectors keep buttons sharp at any device scale, without fonts or downloads. */
const classPaths: Record<ClassId, string> = {
  berserker: `
    <path d="m8 29 20-20M11 8l5 1 7 7 1 5-7-1-7-7-1-5Zm9 0 5-2 7 7-2 5M8 24l4 4M6 30l2-6 4 4-6 2Z"/>
    <path d="m18 24 5 5m0-7 6 6M9 8l-3 5 6 6"/>`,
  paladin: `
    <path d="m18 3 12 5v10c0 7-7 12-12 15C13 30 6 25 6 18V8l12-5Z"/>
    <path d="M18 8v19m-5-13h10m-9 7 4 6 4-6M10 10l3-1m10 0 3 1"/>`,
  assassin: `
    <path d="M6 5 19 24l-4 3L5 12 6 5Zm24 0L17 24l4 3 10-15-1-7Z"/>
    <path d="m9 24 7 5m11-5-7 5m-7-1-4 5m14-5 4 5M14 9l4-4 4 4"/>`,
  ranger: `
    <path d="M9 4c18 3 18 25 0 28L15 18 9 4Zm0 0v28M4 18h27m-5-4 5 4-5 4"/>
    <path d="m5 14 4 4-4 4M20 7l3-3m1 6 4-1m-8 20 4 3"/>`,
  elementalist: `
    <path d="M18 3v30M3 18h30M7 7l22 22M7 29 29 7"/>
    <path d="m18 7 6 11-6 11-6-11 6-11Zm-3-2 3-3 3 3m10 10 3 3-3 3M5 15l-3 3 3 3m10 10 3 3 3-3"/>`,
  necromancer: `
    <path d="M11 31 23 7M17 7c9-7 16 0 15 10-4-7-10-8-15-5m-7 5c-7 2-6 12 1 13l5-3 1-6-7-4Z"/>
    <path d="m9 22 2 2m3-2-2 3m-2 2h3M21 4l3 2m-7 7 4 2"/>`,
  monk: `
    <path d="M10 13V8a2 2 0 0 1 4 0v7-9a2 2 0 0 1 4 0v9-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v9l-4 8H11L6 19a3 3 0 0 1 5-3l3 4"/>
    <path d="M11 30h12M4 9 2 7m27 0 3-3m-2 16 4 1M14 24h7"/>`,
  lanceman: `
    <path d="m7 31 16-23 7-5-2 9-4-1L10 33M21 13l5 4m-6-2 4 3M9 28l3 3"/>
    <path d="M4 16c-1-6 2-10 7-12m1 7 1-7-7 1m20 27c6-4 8-9 6-13"/>`,
  warlock: `
    <circle cx="18" cy="18" r="8"/><path d="M18 5c14 0 14 26 0 26S4 5 18 5Z"/>
    <path d="M5 18c0-14 26-14 26 0S5 32 5 18Zm13-5 3 5-3 5-3-5 3-5ZM5 5l3 2m20 22 3 2"/>`,
};

/** All 36 skills have a silhouette chosen for the actual mechanic. */
const skillPaths: Record<string, string> = {
  cleave: `
    <path d="M5 25C3 11 15 3 28 8M9 28C8 16 17 10 29 12M12 30 26 16l3-7-7 3L9 26"/>
    <path d="m6 25 5 5m11-3 3 5m3-10 5 2"/>`,
  whirlwind: `
    <path d="M9 10c13-10 28 4 18 16S1 25 5 14m1 5c4 12 21 11 21-1S10 5 9 17m5-2c5-5 11 1 6 6"/>
    <path d="m4 7 5 3-2 6m20 9 3 4-6 1"/>`,
  bloodrage: `
    <path d="M18 3c-2 8-11 12-11 20a11 11 0 0 0 22 0c0-8-9-12-11-20Z"/>
    <path d="m10 20 5-4-1 6 8-4-2 8 6-3M5 8l4 3m19-3-4 3"/>`,
  meteoraxe: `
    <path d="m5 5 11 11M4 13l10 8M13 3l10 11M15 20l5-7 10 7-6 9-9-9Zm2 11 9-14m-4 2 7 5"/>
    <path d="m5 22 5 3m0 6 3-3m14 4 5-3"/>`,
  smite: `
    <path d="M18 2v27m-6-18h12m-9 14 3 7 3-7M7 4l3 4M4 15h6m18-9-3 4m1 6h7"/>
    <path d="m7 28 7-3m10 0 6 4M5 32h26"/>`,
  sanctuary: `
    <ellipse cx="18" cy="27" rx="14" ry="6"/><ellipse cx="18" cy="27" rx="9" ry="3"/>
    <path d="M18 4v20m-6-13h12M9 15v8m18-8v8m-5-17 3-3m-13 3-3-3"/>`,
  radiance: `
    <path d="M3 27 26 8l7-4-4 8L7 31m13-17 4 5M6 23l4 5m17-11 6 1M19 4l2 6M3 17l6 1"/>
    <path d="M13 31h12m-5-5h8"/>`,
  divineverdict: `
    <path d="M18 3v21M8 11h20M11 11l-6 10h12l-6-10Zm14 0-6 10h12l-6-10ZM11 31h14m-7-7-5 7m5-7 5 7"/>
    <path d="m4 5 3 2m22 0 3-2"/>`,
  shadowcut: `
    <path d="M5 29 25 5l5-2-1 6L10 32M4 17l17-9M14 31l18-14m-23 5 5 4"/>
    <path d="m3 10 5 1m20 19 5-1M15 3l2 4"/>`,
  venomstar: `
    <path d="m18 3 4 10 10 5-10 4-4 11-4-11-11-4 11-5 4-10Z"/>
    <circle cx="18" cy="18" r="3"/><path d="m6 5 4 4m18 18 3 3M5 29l5-4m16-15 4-5"/>`,
  deathblossom: `
    <path d="M18 18C3 7 10-3 18 12 26-3 33 7 18 18c15-3 20 9 3 5 11 12 0 20-3 3C15 43 4 35 15 23-2 27 3 15 18 18Z"/>
    <circle cx="18" cy="20" r="3"/>`,
  nightfall: `
    <path d="M25 3C6 11 14 30 32 25 18 43-3 18 13 6M5 30l21-12M8 33l22-13"/>
    <path d="m23 8 1 3m7 3 2 1M4 5l1 3"/>`,
  piercingarrow: `
    <path d="M3 29 30 6m-10 1 11-2-3 11M7 20l1 7 7 1M4 25l1 6 6 1"/>
    <path d="M3 14h8m-1-6h10m2 18h10m-12 6h9"/>`,
  multishot: `
    <path d="M5 31 18 6m-5 3 5-5 1 8M8 32 29 13m-7 0 9-2-2 8M4 27 7 6m-3 5 4-8 3 9"/>
    <path d="m4 21 4 3m2 1 4 4m-5-9 5 3"/>`,
  naturepulse: `
    <path d="M18 29V14m0 7C3 22 3 10 5 7c13 0 13 8 13 14Zm0-5C31 16 31 7 29 4c-11 0-12 6-11 12Z"/>
    <path d="M8 26c-9 7 28 10 21 0M4 29l-1-5m30 5 1-5"/>`,
  starfallarrow: `
    <path d="m23 4 2 5 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1 4-5ZM4 32l16-16M4 23l1 8 8 1"/>
    <path d="m4 7 4 2m0 5 4 1m14 13 6 3"/>`,
  fireball: `
    <path d="M17 3c5 9-2 9 4 15 2-4 4-4 4-9 13 11 4 23-7 23S2 21 10 13c-1 9 3 9 4 10 6-7-1-12 3-20Z"/>
    <path d="M14 29c-6-4-1-9 3-12-1 6 5 5 5 9 0 2-2 4-4 4"/>`,
  frostnova: `
    <path d="M18 3v30M5 10l26 16M5 26l26-16m-18-5 5 5 5-5m-10 26 5-5 5 5M5 15l7-1-2-7m16 22-2-7 7-1M5 21l7 1-2 7m16-22-2 7 7 1"/>`,
  stormwave: `
    <path d="m19 3-9 15h8l-3 15 13-21h-9l3-9M4 10h6M2 17h5M5 26h5m19-2h5m-8 6h6"/>
    <path d="M3 31c4 3 9 2 12 0m10-26c3-2 6-1 8 1"/>`,
  cataclysm: `
    <path d="m18 2 3 10 10-5-5 11 8 5-11 1 2 10-9-7-9 7 3-11-9-6 11-2L8 5l9 6 1-9Z"/>
    <circle cx="18" cy="19" r="5"/>`,
  soulreap: `
    <path d="m9 32 13-26m-6 1C26-2 35 8 32 19c-3-9-9-11-16-8"/>
    <path d="M4 19c10-6 13 10 3 12 5-5-4-4-3-12Zm13 0 3 2m-5 3 3 2"/>`,
  plague: `
    <circle cx="18" cy="18" r="4"/><path d="M17 13C4 9 10 0 17 5m6 12c10-8 16 1 10 6M15 23c3 13-9 15-12 7m15-20c13-3 16 9 10 11M11 18c-8 7-8-6-4-8m15 15c5 8-7 11-11 5"/>`,
  gravecircle: `
    <ellipse cx="18" cy="28" rx="15" ry="5"/><path d="M10 26V14a8 8 0 0 1 16 0v12M18 11v10m-5-6h10M5 20v6m26-6v6"/>
    <path d="m12 4-2-2m15 2 2-2M15 28h6"/>`,
  soulharvest: `
    <path d="M18 4c9 0 13 7 10 14l-4 6v7H12v-7l-4-6C5 11 9 4 18 4Z"/>
    <path d="m11 13 5 2-3 4-2-6Zm14 0-5 2 3 4 2-6ZM17 23l1-3 1 3m-3 4v4m4-4v4M4 3l2 4m24-4-2 4"/>`,
  tigerpalm: `
    <path d="M11 31V20l-5-8 4-2 4 6V6l4-1v11l3-9 4 2-3 10 5-5 3 3-7 11v3H11Z"/>
    <path d="M3 23h4m22 4h4m-21-7 8 4m-7-1 6 4"/>`,
  dragonbreath: `
    <path d="m4 14 7-8 4 4 6-1-2 6 5 4-11 2-5 8-4-7 5-6-5-2Zm8 0h2m10 2 7-5-1 7 4 4-8 1 4 6-10-3"/>
    <path d="m12 6 1-4m4 8 2-6M9 23l5 5"/>`,
  meditation: `
    <circle cx="18" cy="7" r="4"/><path d="M12 16c1-5 11-5 12 0l5 8-6 2-5-5-5 5-6-2 5-8ZM8 31h20m-19-3 9-4 9 4M4 10l2 3m24-3-2 3"/>
    <path d="M18 14v5m-3-3h6"/>`,
  thousandfists: `
    <path d="M13 23V13l4-1v6-9h4v9l3-7 4 2-4 10-4 6h-9l-7-9 4-3 5 6Z"/>
    <path d="M2 12h6M4 5l7 4m2-7 2 5m13 0 3-4m-1 17 5-1M3 29h4m21 1 4 1"/>`,
  impale: `
    <path d="m2 29 22-18 9-8-4 12-4-2L5 32M18 16l5 6m-8-3 5 6M3 15h10m-5-8h11"/>
    <path d="m28 22 4 3m-9 2 2 6"/>`,
  sweepinglance: `
    <path d="M6 28 26 8l6-4-3 8-3-3M3 17C5 1 31 1 33 17m-2 4C25 34 8 36 3 24"/>
    <path d="m5 10-2 7 7-1m17 6 4-1 2 5M11 22l5 5"/>`,
  javelin: `
    <path d="m3 30 24-23 6-3-3 8-3-3M17 4l-4 8h6l-4 7m12-1-6 8h6l-3 7"/>
    <path d="M2 17h6m-1 4h5m-3 8 3 3"/>`,
  dragonspear: `
    <path d="M4 32 25 11l7-8-2 12-4-3M3 12l9-8 5 4-2 6 7 2-7 3-2 8-6-6 4-5-8-4Z"/>
    <path d="m14 11 1-1M22 28l3 4m3-9 5 2M16 26l4 4"/>`,
  voidbolt: `
    <path d="M25 6c-12-5-15 13-6 14 8 2 12-8 6-10-7-2-6 6-2 4M3 32l19-14M3 23l1 8 8 1"/>
    <path d="M5 9l4 1M14 3l1 3m16 19 2 2m-10 3 1 3"/>`,
  hellfire: `
    <path d="M9 31C-1 19 8 15 8 7c5 1 4 10 9 8 5-2-2-11 3-13 0 12 17 13 9 27l-5-7-3 10-5-8-7 7Z"/>
    <path d="m10 18 4 2m11-4-4 3M16 31h5"/>`,
  lifetap: `
    <path d="M18 11C10-2-5 13 18 31 41 13 26-2 18 11Z"/>
    <path d="M3 20h8l3-7 5 13 3-8h11M6 6l-3-3m27 3 3-3"/>`,
  singularity: `
    <circle cx="18" cy="18" r="6"/><ellipse cx="18" cy="18" rx="16" ry="7" transform="rotate(-28 18 18)"/>
    <path d="M18 3C1 5 4 31 19 33m7-28c8 6 9 14 4 21M9 4l-3 5M30 28l-4 4m-9-17-2 4 4 2 2-4-4-2Z"/>`,
};

function svg(paths: string, kind: 'class' | 'skill'): string {
  return `<svg class="atlas-icon atlas-${kind}" viewBox="0 0 36 36" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

export function classIcon(id: ClassId): string {
  return svg(classPaths[id], 'class');
}

export function skillIcon(id: string): string {
  return svg(skillPaths[id] ?? skillPaths.voidbolt, 'skill');
}
