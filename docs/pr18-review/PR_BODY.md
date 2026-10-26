Regions previously reused the same scene organization and allowed level-only travel from a list; every dungeon also shared one floor plan. This change gives the five outdoor regions independent expanded terrain/art/atmosphere profiles and four dungeons distinct room geometry, collision layouts, lighting, props and boss models.

- SceneManager unloads old terrain and static physics, awaits required art under a named loading screen, and retains hero/inventory/progression.
- Adjacent physical portals require the ordered main quest (guardian, hunt, collection, boss), then arrival at the next guardian. Sealed portals have real collision barriers.
- Removes the Portals UI and construction tab/production; migrates old quest/dungeon selections and preserves earned character state. Bookmarks operate only within the current map.
- Each dungeon has three progression rooms plus a throne room, synchronized gates and destructible seals; entry/return replace outdoor actors/weather correctly.
- Adds 15 source-pinned CC0 scenery GLBs and real local-scene cartography.

Validation: 266 tests / 43 files; TypeScript/Vite build; real Engine gate/arrival/dungeon-return browser checks; render captures of all five worlds and four dungeons with no JavaScript/shader errors. Evidence and detailed migration/ownership notes: `docs/pr18-review/README.md`. No APK/native builds or Android files changed.
