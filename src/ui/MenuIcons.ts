/** Small authored vector silhouettes shared by every menu; no platform font glyphs. */
export const MENU_ICON_NAMES=[
  'arena','gather','rewards','runes','market','crown','talents','classes','inventory',
  'collection','base','codex','dungeons','shop','summon','vip','pass','clan','settings',
  'map','teleports','quest','close','back','attack','dash','dodge','guard','potion',
  'menu','chevron','sound','mount','jump','interact','crystal','scroll','gold','portal','lock','forge',
] as const;
export type MenuIconName=typeof MENU_ICON_NAMES[number];

const swords='<path d="m5 5 3 1 12 14-3 3L5 9Zm22 0-3 1-12 14 3 3L27 9Z"/><path d="m6 21 5 5m-7 1 4-4m13-2 5 5m1 1-4-4"/>';
const crown='<path d="m4 11 7 6 5-11 5 11 7-6-4 15H8Z"/><path d="M9 23h14"/><circle cx="16" cy="20" r="2"/>';
const scroll='<path d="M9 5h15a3 3 0 0 1 3 3v3h-5V8M9 5a3 3 0 0 0-3 3v16a3 3 0 0 1-3 3h19a3 3 0 0 0 3-3v-3H10v3c0 2-1 3-3 3"/><path d="M11 12h9m-9 4h7"/>';
const shield='<path d="m16 3 11 4v9c-1 6-6 10-11 13C11 26 6 22 5 16V7Z"/><path d="m10 14 4 4 8-9"/>';
const book='<path d="M16 7C10 3 7 4 3 5v21c5-2 9-1 13 2 4-3 8-4 13-2V5c-4-1-7-2-13 2Zm0 0v21M7 10l5 1m8 0 5-1M7 15l5 1m8 0 5-1"/>';
const crystal='<path d="m16 3 10 8-2 11-8 8-8-8-2-11Zm-10 8h20M16 3l-4 8 4 19 4-19Z"/>';
const paths:Record<MenuIconName,string>={
  arena:swords,
  gather:'<path d="M6 27c3-9 10-17 20-22 1 11-3 20-13 20H6Z"/><path d="M5 29 23 10m-13 9 1-7m6 4 7 1"/>',
  rewards:'<path d="M4 14h24v6H4Zm2 6v9h20v-9M16 14v15"/><path d="M16 14c-11 0-12-8-7-9 4-1 7 9 7 9Zm0 0c11 0 12-8 7-9-4-1-7 9-7 9Z"/>',
  runes:'<path d="m16 3 11 13-11 13L5 16Z"/><path d="M16 8v16m-6-13 12 10m0-10-12 10"/>',
  market:'<path d="M16 3v24M6 8h20M7 8 2 19h10Zm18 0-5 11h10ZM9 28h14"/><path d="M2 19c0 5 10 5 10 0m8 0c0 5 10 5 10 0"/>',
  crown,
  talents:'<path d="m16 3 3 8 9 1-7 6 2 10-7-5-7 5 2-10-7-6 9-1Z"/><path d="m10 16 6-6 6 6-6 6Z"/>',
  classes:'<path d="m16 3 10 4v11l-10 11L6 18V7Z"/><path d="m10 11 6 6 6-6M16 17v7"/>',
  inventory:'<path d="M4 13V9a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v19H4Zm0 0h24M10 5v23M22 5v23"/><path d="M13 11h6v7h-6Z"/>',
  collection:'<path d="M15 25C7 24 2 19 3 8l10 5L8 3l8 5 8-5-5 10 10-5c1 11-4 16-12 17"/><path d="m12 18 4-5 4 5-4 11Z"/>',
  base:'<path d="M5 29V13l11-8 11 8v16M2 14 16 3l14 11M12 29V18h8v11M3 29h26"/>',
  codex:book,
  dungeons:'<path d="M5 29V12C5-2 27-2 27 12v17ZM10 29V14c0-8 12-8 12 0v15"/><path d="M6 12h4m12 0h4M16 3v6M7 8l4 3m10 0 4-3M5 20h5m12 0h5"/>',
  shop:'<path d="m4 12 3-8h18l3 8v4c-3 3-6 1-6-2 0 4-6 4-6 0 0 4-6 4-6 0 0 3-3 5-6 2ZM6 19v10h20V19M11 29V19h9v10"/>',
  summon:'<circle cx="16" cy="16" r="13"/><circle cx="16" cy="16" r="9"/><path d="m16 4 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z"/>',
  vip:crown,
  pass:scroll,
  clan:'<path d="M7 29V3m0 2h19l-4 7 4 7H7"/><path d="m14 9 2 3 4 1-3 2v3l-3-2-3 1 1-4Z"/>',
  settings:'<path d="m13 3-1 4-4 2-4-1-2 5 3 3v3l-3 3 3 5 4-1 3 2 1 4h6l1-4 3-2 4 1 3-5-3-3v-3l3-3-2-5-4 1-4-2-1-4Z"/><circle cx="16" cy="17" r="5"/>',
  map:'<path d="m3 7 9-3 9 3 8-3v22l-8 3-9-3-9 3Zm9-3v22m9-19v22"/><path d="M16 10c-5 0-5 6 0 10 5-4 5-10 0-10Z"/>',
  teleports:'<ellipse cx="16" cy="21" rx="13" ry="7"/><ellipse cx="16" cy="21" rx="8" ry="3"/><path d="M10 18V9a6 6 0 0 1 12 0v9M7 12l3 6 4-5m4-7 4-4 3 4"/>',
  quest:scroll,
  close:'<path d="m8 8 16 16M24 8 8 24"/>',
  back:'<path d="m15 7-9 9 9 9M6 16h21"/>',
  attack:'<path d="m8 24 15-18 5-3-2 6L11 27Zm-3-7 10 9M4 29l5-6"/>',
  dash:'<path d="m18 2-9 15h8l-3 13 12-18h-8l3-10ZM3 8h6M1 16h5m-3 8h6"/>',
  dodge:'<path d="M7 10a11 11 0 1 1-2 10M3 6l4 4 5-3"/><path d="m16 10-4 7h6l-2 6"/>',
  guard:shield,
  potion:'<path d="M12 3h8v5h-8Zm1 5v5C1 21 7 29 16 29s15-8 3-16V8"/><path d="M9 21h14M16 16v9m-4-4h8"/>',
  menu:'<path d="M5 8h22M5 16h22M5 24h22"/><circle cx="11" cy="8" r="2"/><circle cx="21" cy="16" r="2"/><circle cx="13" cy="24" r="2"/>',
  chevron:'<path d="m10 6 10 10-10 10"/>',
  sound:'<path d="M4 12h5l8-7v22l-8-7H4Zm17-2c5 3 5 9 0 12m4-16c8 6 8 14 0 20"/>',
  mount:'<path d="M7 28v-9l6-7 6 5h7l3-9-7-4-5 8M7 20h18v8M5 28h5m12 0h6M21 7l2-5"/>',
  jump:'<path d="m8 15 8-10 8 10M16 5v22M6 28h20"/>',
  interact:'<path d="M13 4h12v24H13M3 16h15m-5-5 5 5-5 5"/>',
  crystal,
  scroll,
  gold:'<ellipse cx="16" cy="7" rx="12" ry="4"/><path d="M4 7v6c0 6 24 6 24 0V7M4 13v6c0 6 24 6 24 0v-6M4 19v6c0 6 24 6 24 0v-6M9 11v4m14-4v4M9 23v4m14-4v4"/>',
  portal:'<ellipse cx="16" cy="16" rx="10" ry="14"/><ellipse cx="16" cy="16" rx="6" ry="10"/><path d="M2 29h28M16 2v4m0 20v4M6 16h4m12 0h4m-14-5 4 5-4 5m4-5h8"/>',
  lock:'<path d="M7 14h18v15H7Zm4 0V8a5 5 0 0 1 10 0v6M16 21v4"/><circle cx="16" cy="20" r="2"/>',
  forge:'<path d="M3 14h26l-7 6H9Zm8 6-2 7h15l-3-7M18 4l-9 12m6-15 9 6-4 5-9-6Z"/>',
};

const escape=(value:string):string=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]!);

export function menuIcon(name:MenuIconName|string,label?:string):string {
  const key=Object.hasOwn(paths,name)?name as MenuIconName:'quest';
  const accessible=label?`role="img" aria-label="${escape(label)}"`:'aria-hidden="true" focusable="false"';
  return `<svg class="menu-icon menu-icon-${key}" data-menu-icon="${key}" viewBox="0 0 32 32" ${accessible} fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${paths[key]}</svg>`;
}
