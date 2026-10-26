# PR18 — Independent worlds, physical campaign gates and dedicated dungeons

Based on merged PR17 (`79c22af`). No APK, Gradle, Capacitor sync or Android-resource changes were made.

## Runtime architecture

`src/world/SceneManager.ts` owns one terrain instance and its static physics. `unloadCurrentMap()` removes the prior map's scene graph, owned geometry/materials and static bodies. `loadMap()` waits for required art; failures restore a safe previous region. `MapInstanceManager` is a compatibility export of this same class, not a second manager. Engine separately replaces regional monsters, NPCs, portals, sky, gathering nodes, weather and transient combat effects while retaining the hero body, inventory and progression.

A named, input-blocking loading layer covers the transition. Normal travel requires entering the physical portal aperture. Portal permission checks adjacent regions, minimum level and completed mandatory quests; sealed portals have both a red shader barrier and an actual Cannon collider. Reverse portals lead only to the preceding region.

| World | Levels | Terrain width | Main visual identity |
| --- | --- | --- | --- |
| Vale de Aster | 1–15 | 360 m | Forest, real GLB village, crystal river and moss ruins |
| Cemitério das Cinzas & Cripta | 15–35 | 400 m | Dead trunks, graves, coffins, crypt and dense purple-grey fog |
| Ruínas de Cristal Gelado | 35–60 | 420 m | Snow/ice terrain, authored snow pines, giant blue crystals and snow |
| Desfiladeiro da Forja Ardente | 60–85 | 440 m | Dark volcanic ground, flowing lava, supported bridge, giant anvil and hanging chains |
| Santuário Abissal do Fim | 85–100 | 480 m | Separated islands connected by a safe route, void architecture, purple crystals and stars |

Each scene has its own heightfield seed/profile, lighting, fog, ambience pitches, native monster distribution and boss presentation. GPS samples the active terrain and rejects void/lava routes; the atlas is rebuilt for the current scene. World GLB instances clone owned geometry so unloading releases their renderer buffers; immutable source templates and shared actor resources remain cached.

## Campaign and saves

Every region has four mandatory, ordered steps: guardian conversation, native monster hunt, actual local resource collection, regional boss. Rewards are granted once when claimed. Completing a chapter changes the next story task to “Atravesse o Portal Ancestral e apresente-se ao Guardião”; entering the next map places the hero within conversation distance of its gold `!` guardian. Claiming that arrival reward starts the next hunt.

The quest snapshot uses schema 2 and stable IDs. Previously earned three-step chapters gain the inserted collection step during migration. Uncompleted legacy high-level map visits do not grant campaign unlocks; these saves return safely to an eligible starting scene, retaining items, currency, talents and character level. Retired `roots`/`tide` dungeon selections migrate to `tombs`; historical completion keys remain intact.

There is no Portals menu/trigger or construction tab/key binding. Building production/upgrades are retired from live gameplay; old purchased building bonuses/save data remain readable to avoid removing previously earned character power. Ten bookmark slots remain available **within the current map**; they cannot bypass physical region gates. Developer region previews remain explicitly local test tools, separate from online authority.

## Dungeon ownership

The active catalog contains four dedicated maps, with different room/corridor silhouettes, collision outlines, materials, lights, props and GLB boss forms:

- **Catacumbas do Rei Ossudo:** blue light, damp stone, coffins, skulls, necrotic throne and skeleton Lich.
- **Templo do Cristal Corrompido:** offset ice chambers, quartz crystals, cold reflections and Crystal Colossus.
- **Fornalha do Titã de Magma:** branching forge rooms, lava bed/cascades, suspended chains, anvils and Forge Lord.
- **Cidadela do Vazio Abissal:** cathedral layout, dark reflective floor, animated stained glass, void altar and Abyssal Emperor.

Each has three progression rooms plus a separate throne room, three physical/visual gates, destructible seals and a completion chest. Existing difficulty/reward/floor rules are retained. A new floor resets its crystals. Entry requires that dungeon's physical entrance in its native unlocked region. Leaving restores the previous outdoor scene, its native mobs and retained gathering stock; outdoor NPCs/weather/scenery are absent inside.

## Validation

- `npm test`: **266 tests in 43 files pass**. Fourteen new behavioral tests cover complete campaign progression, forged level-only unlock attempts, duplicate arrival rewards, aperture triggers, physical barrier reuse, legacy migration, unload/rollback, island navigation and independent dungeon plans.
- Existing tests that encoded the retired three-step/level-only/shared-room behavior were updated to the requested four-step, quest-gated, four-room contracts. Existing economy, combat, equipment, online, rendering and asset tests remain active.
- `npm run build`: TypeScript/Vite pass. The existing large-entry-size warning remains informational.
- `python scripts/smoke-pr18.py`: real Engine test for sealed gate → claimed campaign → physical crossing → named loading → guardian arrival/reward → exclusive dungeon → safe return. Verifies one map root, removed old monster bodies, retained hero body/resources, no outdoor NPC/weather in the dungeon, duplicate reward denial and zero JavaScript/shader/network errors.
- `scripts/review-pr18.html` renders the production map/physics/dungeon builders for all five worlds and four dungeons. PNGs and `browser-report.json` are adjacent. Scene snapshots use a fixed overview camera and simplified review lighting without dynamic shadows; game rendering keeps its existing quality settings. HUD/dialogue captures hide the main-world canvas to bound software-GPU readback. These are layout/ownership/asset checks, not an Android FPS benchmark.

Fifteen additional authored CC0 GLBs (about 1 MB) have immutable source URLs, hashes and license records in `public/models/pr18/manifest.json`. `node scripts/import-pr18-world.mjs` reproduces the import. Shaders provide river/lava motion, weather and magic on architecture; imported models provide scenery and creatures.
