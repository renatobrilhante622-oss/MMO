# Mobile actor derivatives

Generated offline with `node scripts/optimize-actors.mjs`. Originals and their upstream license manifests remain unchanged. Runtime `ModelResources` routes actor, weapon and accessory loads to these derivatives and shares immutable geometry/textures across clones.

Processing: deduplicate, weld, simplify to a target 60% triangle ratio with maximum relative error 0.001 and locked borders, resample redundant keyframes, reorder vertex buffers, apply Meshopt FILTER compression without changing node/bone coordinate systems, convert embedded textures to lossless WebP at at most 512px. Clip names and skin attributes are retained; topology constraints can prevent the target ratio on low-poly meshes. No geometry simplification runs during gameplay.

`manifest.json` records each original/derivative hash, bytes, triangles, vertices, texture dimensions and clips. `src/assets/optimized-models.json` is generated in the same step. The two source-pinned Quaternius horses replace legacy horse meshes at runtime. The old files remain only for existing asset provenance/regression contracts.

WebP reduces transfer/storage size, not decoded GPU texture size: WebGL still uploads RGBA plus mipmaps. Meshopt reduces buffer transfer size; simplification, sharing, actor-wide frustum culling, bounded clone pooling and avoiding hidden procedural rigs reduce runtime work. Neither guarantees a frame rate on arbitrary Android hardware.
