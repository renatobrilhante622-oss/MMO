# ETERNA — Migração CC0 de terrenos, ambiente e criaturas

Esta entrega utiliza somente GLBs criados por artistas e albedos/normais/roughness
de fotografias reais, armazenados localmente no APK. O código continua gerando
partículas/shaders, autorizados pela direção de arte, mas não sintetiza mapas por Canvas.

## Origem verificável

**18 GLBs** `public/models/environment/*.glb`:
- 15 objetos Kenney, com origem no repositório `Hidencod/tge-assets`
  (Nature Kit, Graveyard Kit, Castle Kit e Mini Dungeon).
- 3 personagens/criaturas da Quaternius, disponibilizados pela base do jogo
  `ilrein/warptracker`: `ghost`, `demon`, `bat`.

**15 texturas PBR WebP**, derivadas de fotografias `ambientCG`:
`Grass004`, `Ground071`, `PavingStones046`, `Snow010A`
e `Ground093C`; cada material tem base color, normal GL e roughness.

**Verificação:** `scripts/import-real-environment.mjs` verifica o SHA-1 de
Git para cada recurso original, exigindo correspondência exata com o commit
fixado. Somente as fotografias originais são redimensionadas/comprimidas em
WebP com Sharp (não há geração de pixels por desenho).
O arquivo `public/models/environment/manifest.json` lista caminho,
fonte, hash, tamanho, licença e crédito por asset.

Fontes:
- https://github.com/Hidencod/tge-assets
- https://github.com/ilrein/warptracker
- https://github.com/Kevin-Liu-01/Claude-of-Tanks
- https://kenney.nl/assets/nature-kit
- https://ambientcg.com

## Migração visual efetiva

- `src/world/ProceduralTextures.ts`: nenhuma CanvasTexture, imagem gerada
  em código ou cálculo de normal map.
- `src/world/WorldShaders.ts`: amostragem real de cinco canais de albedo,
  transições por região por shader, sem desenhar grama/areia/noise como textura.
- `src/world/EnvironmentGLB.ts`: desenha árvores, lápides, rochas, torres e
  ruínas com `InstancedMesh` a partir de geometria GLB verdadeira.
- `OpenWorldGenerator.generate`: deixa de chamar as rotinas antigas de
  geração de árvores, prédios e vilarejos geométricos e usa assets GLB.
- `CreatureRig`: fantasma/espectro e boss migrados para Quaternius GLB.
- `ArticulatedCharacter.skinAppearance`: skins não são apenas uma cor:
  selecionam outros cinco corpos KayKit reais e preservam VFX de raridade.

## Limitações que precisam de novas entregas

1. A geometria triangulada do **solo físico** ainda deriva do campo de altura
   existente, para preservar colisões, água e movimentação. **Não é um terreno
   100% baseado em GLB**, embora suas texturas agora sejam reais.
2. Lobos, slimes e golems ainda têm rigs visuais geométricos antigos. Não os
   substituí por animais de espécie errada. Também faltam assets oficiais
   aprovados para aranhas, escorpiões, lichs, dragões e alguns pets/montarias.
3. Os GLBs ambientais Kenney são modelos low-poly authored e mantêm a
   paleta original de materiais; as texturas PBR escaneadas são do solo.
4. O conjunto `Ground093C` representa chão gasto/queimado, não rios de
   lava autênticos. Lava interativa exigirá asset apropriado e física/VFX.
5. O sistema de skins ainda não adiciona por skin uma nova malha de asa,
   elmo ou sela. A transformação de corpo e a aura são reais, mas não
   representam a entrega completa do catálogo solicitado.
6. A física, navegação e o mapa ainda usam o mesmo mundo lógico do projeto.
   Para cinco mundos independentes será necessário separar estados de cena,
   instanciar os colliders por mapa e fazer streaming seguro.
7. FPS em Android físico não foi medido. `InstancedMesh` reduz chamadas de
   desenho, mas 60 FPS não está garantido.

A economia online não é alterada. `npm test` e `npm run build` executam
em CI; compilação do APK apenas no GitHub Actions após merge.
