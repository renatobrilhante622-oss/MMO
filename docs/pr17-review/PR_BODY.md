Mobile skins were paying for repeated GLB loads, hidden procedural rigs and redundant presentation work; some mount names and accessories also disagreed with their actual model. This change adds offline optimized authored assets, shared resources and bounded skeleton pooling, conservative actor culling, class-aware cosmetic attachments and a peripheral mobile HUD.

- 98 GLBs: 41.9 MB → 21.3 MB; 144k → 126k triangles, retaining animations and bone coordinates.
- New CC0 animated brown/white horses, smoothed animal surfaces, corrected casting weapons and dragon wings.
- Gold/cyan/red HUD with circular map/skills, compact drawer, collapsible quests/drops and shorter menu copy.
- Gameplay rules, economy, saved cosmetic IDs and online authority stay unchanged.

Validation: 252 tests in 42 files; TypeScript/Vite build; real browser HUD checks at 844×390, 390×844 and 360×800, plus GLB previews with no JavaScript/shader errors. Evidence and limitations: `docs/pr17-review/README.md` and screenshots. 60 FPS requires physical Android profiling and is not claimed by these software-GPU checks. No APKs or Android builds were generated locally.
