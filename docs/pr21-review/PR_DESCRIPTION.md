## Problema e resultado

Os cinco mapas ampliados tinham poucas atividades entre os spots e a campanha terminava rapidamente. Agora há 12 missões em três atos por região, contratos repetíveis C–SS, seis capitães por mapa, acampamentos guardados, ninhos destrutíveis, santuários e invasões de três ondas seguidas de um demônio.

## Implementação

- 98–155 pontos físicos por região, com GLBs CC0 instanciados, colliders, ícones no minimapa/atlas e GPS. Quadro junto ao guardião e botão direto de Contratos na HUD.
- Progresso exige ações reais: coleta no pickup, guardas mortos, dois capitães distintos e defesa de 45 segundos. Campanha governa o nascimento do chefe e preserva o portal físico.
- Massacre com bônus de XP/drop nos marcos 10/25/50/100 e baú destrutível a cada 50 mortes; tesouros utilizáveis para skins e refino.
- Salvamento migrado sem retirar regiões já concluídas nem repetir pagamentos. Contratos anteriores não acumulam registros; ondas têm limite de população e descarregamento próprio.
- Economia e buffs permanecem no PvE local, separados de contas/carteiras/PvP autoritativos. APK e Android inalterados.

## Validação

`npm test`: **345 testes em 46 arquivos**. `npm run build`: TypeScript/Vite aprovados, com o aviso conhecido de tamanho do bundle. Chromium mobile verificou encontros, pickup e UI; fixture gráfico renderizou GLBs/camp/elite/fenda sem erros. Evidências, limites de streaming, migração e reprodução: [docs/pr21-review/README.md](docs/pr21-review/README.md).

As capturas SwiftShader não constituem um benchmark de FPS Android. O build Android fica a cargo do GitHub Actions.
