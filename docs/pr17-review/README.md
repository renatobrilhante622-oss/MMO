# PR17 — Mobile actor budgets and peripheral HUD

The work starts from merged PR16 (`b680451`) and preserves gameplay/economy/save IDs. No Android commands or APK changes were made.

## Results

- 98 actor/weapon/accessory GLBs: **41,944,136 → 21,349,412 bytes (49.1% smaller)**; **144,025 → 126,213 triangles (12.4% fewer)**. All clips remain named and usable. Simplification respects a 0.001 relative-error ceiling, so small meshes need not reach the 60% target ratio.
- New source-pinned CC0 Quaternius brown/white horses, with **13 authored animation clips**, replace the old retrofitted horse and unrigged farm horse in runtime loads. Wolf/dragon GLBs retain their authored skeletons. Crease-aware smoothing preserves their UVs, triangle count and skin weights. Old source files remain for provenance and existing regression contracts.
- Shared geometry, mipmapped lossless WebP textures (maximum 512px), six idle pooled skeleton clones, disposal of evicted bone textures, actor-wide conservative frustum/radius culling and paused offscreen presentation updates.
- Browser actors no longer construct or animate a hidden second procedural body/weapon rig. Changing a hero cosmetic in Collection keeps the same live hero preview rig.
- Class-aware cloth/plate/headgear, preserved source palettes, upright casting implements, one rigged wing set per dragon, capped 24/40/56-mote rarity effects. Fixed a pre-existing invalid GLSL reserved-word use in the rarity shader.
- Gold/cyan/red peripheral HUD; illustrated class portrait, circular minimap and skill controls, compact VIP/Pass/Menu, three-column drawer, collapsed quest tracker and loot pill. World-boss proximity reads actual live boss positions. Less repeated copy in Classes, Buildings, Bestiary and VIP; expanded details retain descriptions. Misnamed companion labels now match the actual authored species without changing save IDs or rewards.
- Fixed a missing upstream `colormap.png` referenced by one existing Ranger weapon; optimized derivatives embed every image.

## Validation

`npm test`: **252 tests / 42 files passing**. `npm run build`: TypeScript and Vite pass. Vite reports the existing large-entry warning (~1.53 MB before gzip); this is not a build error.

`python scripts/smoke-pr17.py` exercises real UI and GLTF loaders at **844×390, 390×844 and 360×800**. Reports and screenshots are adjacent to this file. Tests check viewport bounds, nonoverlapping circular controls, clear screen center, drawer opening/closing, minimap opening the atlas and all ten teleport slots. Separate real production previews render Imperial Warhorse, Alpha Shadow Wolf, Fire Drake and Warlock skin with Meshopt/WebP decoding; no JavaScript or shader errors occur.

HUD captures deliberately hide the expensive main-world canvas so software-GPU readback stays bounded. Asset captures use the actual production `CharacterPreview`, isolated from the world. These are visual/layout checks, **not an Android performance benchmark**. Preview renderer counters include its pedestal and particles; they are not main-world draw-call totals.

A failed intermediate capture caught quantization changing skeleton coordinate systems. The final pipeline preserves authored bone transforms and uses Meshopt FILTER; regression tests verify joint coordinates. A later capture caught duplicate dragon wings and downward staffs; both are corrected in the final screenshots.

## Reproduction and practical limits

`node scripts/import-pr17-horses.mjs` imports from immutable CC0 URLs; `node scripts/optimize-actors.mjs` regenerates derivatives, hashes, metrics and runtime mapping. Build/test do not repeat optimization. Source licenses are under `public/models/` and `public/models/pr17-source/`.

WebP reduces storage/transfer cost; decoded WebGL textures are RGBA plus mipmaps, not GPU block-compressed textures. Meshopt compresses transfer buffers; geometry simplification and avoiding redundant rendering/simulation provide runtime savings. Stylized CC0 assets are not photorealistic skins. **60 FPS on Android is a target, not a verified guarantee.** Validate on physical target devices: cold/warm launches, repeated skin changes, riding, dense combat, and arena; record frame-time percentiles, GPU memory and thermal behavior over a sustained run.
