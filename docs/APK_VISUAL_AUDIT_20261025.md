# ETERNA — Parte 1: mapas 3D, portais, dungeon e APK

**Escopo único:** mapas independentes, física e streaming de regiões, portais 3D e nomes/níveis em placas projetadas, localização dos inimigos, masmorra indoor com 4 dificuldades, modelos renderizados em GLB, correção da paleta KayKit e publicação do APK DEBUG na tag `latest-apk`.

- `MapInstanceManager` descarrega cenário e recria `OpenWorldGenerator` e terreno Cannon em cada região.
- `WorldPortals` exibe arcos 3D reais, vórtices shader e bloqueios de nível, incluindo o desbloqueio por nível real para lv100.
- `DungeonInstance` usa 12 arquivos de arquitetura reais Kenney CC0, 3 salas, 3 cristais atingíveis e baú na arena final. A HUD permite escolher 4 dificuldades e voltar à vila.
- `AnimatedGLB` mantém atlas e material de heróis KayKit montados e `EnvironmentGLB` corrige luz em vegetação; `NPCSystem` faz streaming apenas dos personagens daquela região, com símbolos flutuantes sem blocos pretos.
- `.github/workflows/main.yml` roda `npm test` e `npm run build` e publica `ETERNA-Android-latest.apk` com `softprops/action-gh-release@v2`, após cada push na main. **O arquivo de Release só aparece após merge e sucesso no job Android.**
- Testes em `tests/map-instance.test.ts`, `tests/dungeon-instance-audit.test.ts` e `tests/mount-combat-regression.test.ts`.

**Limitações:** ainda há malhas procedurais para espécies/montarias sem GLBs correspondentes no acervo disponível (incluindo Wyvern). O posicionamento fino de arcos, sela e acabamentos precisa de teste real no Android; testes de código não substituem essa inspeção. IA/arte integral de NPCs e todos os assets requerem importação adicional licenciada. Armadilhas da dungeon são cenográficas neste momento. Nenhuma alteração nesta Parte 1 aborda Forja/Sockets, reorganização de HUD, retratos do diálogo ou cards da Coleção — reservados para o PR da Parte 2.
