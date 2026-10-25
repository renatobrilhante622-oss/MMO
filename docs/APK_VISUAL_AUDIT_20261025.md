# ETERNA — Auditoria estrutural do APK (2026-10-25)

## Módulos modificados

### Mapas físicos separados

`MapInstanceManager.activate(regionId)` gerencia a instância ativa, criando
um novo `OpenWorldGenerator` com campo de altura, ambientes PBR e GLB
específicos. Troca a referência de terreno do `PhysicsWorld` e remove
**somente os corpos estáticos** de Cannon; o personagem preserva seu
`Body`. O mapa anterior é `dispose()` imediatamente depois da troca
bem-sucedida. Cada entrada descarta inimigos, NPCs e drops da região
anterior, e carrega novos objetos da região atual.

A passagem entre mapas ocorre depois de 2,5 s de canalização com cancelamento.
O estado `regionId` é salvo, e bookmarks novos registram seu espaço local.
Bookmarks antigos são convertidos de coordenadas compartilhadas na primeira
travessia. No mundo físico, os portais têm arco GLB Kenney, vórtice
por shader e placas HTML projetadas de coordenadas 3D (sem Canvas).

**Nível de acesso:** nível base da região, impedimento por combate/dungeon
e override local de administrador. A lista antiga `unlockedRegions` não
provoca mais bloqueio indevido em personagens nível 100.

### Masmorra instanciada

`DungeonInstance` usa **12 modelos Kenney CC0** com SHA de origem
verificado. Inclui pisos, paredes, portas, pilares, armadilhas decorativas,
escadas, braseiros, baú e três cristais verdadeiramente destrutíveis. A
instância ocupa um mundo `dungeon` independente; a física possui terreno
invisível plano sob pisos GLB, paredes no perímetro e portais de retorno.
O `DungeonBossManager` usa salas de spawn e bloqueia o chefe enquanto
houver cristal inteiro após as ondas anteriores. A HUD mostra cronômetro,
sala e saída. As quatro dificuldades possuem nível mínimo 10/30/60/85.

**Limites:** armadilhas não causam dano por colisão nesta entrega;
portões têm estado visual, mas a progressão de portas ainda não usa
colisores dinâmicos; a animação do baú não possui explosão própria de
partículas vinculadas ao GLB. Verificar fisicamente no APK os encaixes dos
módulos Kenney, altura das paredes e direção das portas.

### Montaria e renderização

A paleta e atlas originais dos GLBs KayKit deixam de receber tint
global. O rider é anexado ao nó de sela da montaria e o deslocamento
local foi reajustado, conservando o material do GLB.

As árvores importadas agora usam materiais isolados, dupla face, luz
refletida mínima e não geram sombras densas nas próprias folhas. Cada
mapa usa iluminação hemisférica e material de chão específico.

**Limites:** Wyvern, alguns pets, montarias e monstros ainda utilizam
geometria procedimental existente; assets autênticos para essas espécies
não estavam disponíveis nesta importação, e não foram fingidos com
malhas de outros animais. O ajuste visual do cavaleiro ainda requer
observação em aparelho Android real.

### Inventário e UI

- Dados de mapas atualizados no topo do HUD e minimapa.
- Painel duplicado de missão ocultado; tracker e toasts realocados,
  respeitando safe areas e o recurso de movimentação principal.
- `ForgeUI.forgePreview` calcula exatamente o próximo upgrade atual,
  preservando o funcionamento da transação já existente: chance de
  sucesso 100% e sem custo de proteção; não inventa fracassos.
- Layout responsivo com painel de equipamentos, altar, quatro sockets
  (slots superiores restritos por raridade), quatro gemas reais e
  botão `FUNDIR 3:1` conectado ao evento `gem-fuse`.
- Retratos ilustrados por NPC e explicação de recompensa nas quests.
- Cards de coleção com texto quebrando linha e altura segura.

### Workflow Android / Releases

A cada push na `main`, `.github/workflows/main.yml` executa:
`npm test`, `npm run build`, sincronização Capacitor, Gradle
`assembleDebug` na nuvem, upload do artifact e atualização da
tag/release `latest-apk` via `gh release upload --clobber`.
O download será `https://github.com/renatobrilhante622-oss/MMO/releases/tag/latest-apk`
**após merge e execução bem-sucedida** na main. O APK é uma
compilação DEBUG, não uma versão assinada para distribuição pública.

### Testes e pontos de aceitação

- `tests/map-instance.test.ts`: altura/collider, corpos persistentes,
  limpeza das instâncias, limite de nível 100 e NPCs da região.
- `tests/dungeon-forge-audit.test.ts`: integridade GLB, dificuldade,
  colisão do mundo dungeon, cristais, dados de refino e joias.
- `tests/mount-combat-regression.test.ts`: rider na sela e retorno.

**Antes do merge:** verificar o CI da ponta do branch. **Depois do
merge:** instalar APK novo do Release, testar retorno da dungeon, verificar
cena por cena sem texturas esbranquiçadas/pretas, escala dos modelos em
retrato/paisagem e GPU memory. Sem esses testes visuais não há base para
afirmar acabamento comercial definitivo nem FPS mínimo.
