# PR #12 — ETERNA | Finalização técnica para revisão

## Rigs de cavalo e golem

Os GLBs `Creature_horse.glb` e `Creature_golem.glb` foram reescritos mantendo as malhas, materiais e atlas existentes no projeto, com adição de:
- Atributos glTF `JOINTS_0`, `WEIGHTS_0`, `skins`, `inverseBindMatrices` e nós reais de articulação.
- Cavalo: 9 juntas (tronco/raiz, quatro patas, pescoço, cabeça, cauda). Golem: 7 juntas (raiz, tronco, braços, pernas, cabeça).
- Seis `AnimationClip` internos, com canais de transform reais: `Idle`, `Walk`, `Run`, `Gallop`, `Attack`, `Death`.
- `AnimatedGLB` usa `AnimationMixer` e `SkeletonUtils.clone` para playback independente. O cavalo prioriza `Gallop` na corrida, e o golem prioriza `Run`.
- O fallback GPU anterior permanece apenas para outros GLBs verdadeiramente sem clips; não substitui o skinning do cavalo ou golem.

**Proveniência:** a geometria do cavalo e do golem é a malha preexistente de ETERNA, não um novo Quaternius/CC0 obtido de terceiro. O status de licença CC0 isolada desses dois modelos *não foi documentado*; os novos rigs são adaptações dessas malhas. A anatomia deformada precisa de inspeção visual em aparelho e aperfeiçoamento artístico se houver artefatos nas juntas.

## Armas: classe corrigida, ID persistente

- 45 arquivos principais `armory-<classe>-<tier>.glb`, 45 hashes Git diferentes, 9 classes × 5 raridades.
- Os modelos outrora incorretos (livros como armas principais, espadas para Assassin, escudos para Monk, machados para Lanceman) foram substituídos por geometrias de **família adequada**.
- 22 itens são variantes esculpidas por reprofilamento de vértices dos GLBs CC0 originais (escala de comprimento, largura, curvatura e detalhes de perfil); **não são 22 esculturas humanas adicionais adquiridas de terceiros**. Texturas e geometria-base são reais; nenhuma arma é uma primitiva 3D de fallback.
- Berserker: machados grandes e espadões; Paladin: cinco espadas e **cinco modelos diferentes de escudos** na mão esquerda; Assassin: cinco adagas em ambas as mãos; Ranger: cinco arcos e aljava; Elementalist: cinco cajados/cetros; Necromancer: cinco foices; Monk: cinco bastões marciais; Lanceman: cinco lanças; Warlock: cinco cetros/báculos.
- O manifesto inclui `meshFamily`, `shapeOrigin`, `source`, `hash` e `derivative` por item. IDs originais de drop/equipagem permanecem.
- O conjunto de classes do jogo não possui `Warrior` ou `Druid` como classes separadas: a categoria de espada/escudo é `Paladin` e a opção marcial é `Monk`; não foram criadas classes adicionais implicitamente.

## Verificações e limite de validação

`tests/pr12-rigged-arsenal.test.ts` confere integridade Git de cada GLB, classe versus origem geométrica, cinco escudos, contagem de juntas, `JOINTS_0` e `WEIGHTS_0`, clipes e canais de animação. O CI executa `npm test` e `npm run build` no GitHub Actions.

Os testes automatizados comprovam a **estrutura e integração**, mas não comprovam que todas as animações são visualmente naturais, que não existe clipping em todas as poses, nem o desempenho de cada dispositivo Android. Inspeção 3D do cavalo/golem, encaixes e FPS real continua como tarefa de QA antes da distribuição pública.

O workflow de APK permanece via GitHub Actions após integração na `main`; não executar `./gradlew` localmente.
