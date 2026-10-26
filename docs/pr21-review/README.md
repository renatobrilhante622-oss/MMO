# PR #21 — campanha e atividades infinitas no campo

Base: `979b25e`, `main` com os mapas do PR #20 e PvP do PR #19. Branch: `feat/pr21-infinite-mmo-content`.

## Conteúdo jogável

- **60 missões principais**, 12 por região em três atos: encontro com o guardião, caça, investigação física, reagentes protegidos de depósitos distintos, coleta regional, destruição de dois ninhos, defesa de 45 segundos/três ondas, acampamento, dois capitães distintos, ruínas profundas, invasão e chefe regional. O chefe só nasce depois das etapas anteriores. Portais e recompensas de chegada mantêm a progressão anterior.
- **Contratos repetíveis C/B/A/S/SS** no quadro ao lado do guardião e no botão direto **Contratos** da HUD superior. Aceitar antes de cumprir, rastrear/navegar, resgatar uma vez e gerar imediatamente o próximo. Objetivos alternam caça, ninhos, elites, núcleos coletados e acampamentos. Quantidades e recompensas crescem; o save retém somente o contrato atual de cada região.
- **Seis capitães por mapa**, com modelo GLB ampliado 2,5 vezes, aura, nome de elite, caveira no minimapa/atlas e ataque de área telegrafado. Respawn de 180 segundos. A morte gera equipamento Raro/Épico, fragmentos de skin e baú trancado.
- **Acampamentos físicos** com tendas, barricadas colidíveis, fogo e baú. Os seis a oito guardas precisam morrer antes que o baú possa ser aberto. Não basta sair do raio ou descarregar monstros.
- **Fendas** alternam três locais por região. A primeira aparece após 100 segundos de jogo e a próxima é programada 150 segundos após a conclusão. São três ondas e um demônio; só então surgem cinco drops com pilares luminosos, incluindo um baú de skin por invasão. O evento expira após 210 segundos. O objetivo da campanha permite ativar uma fenda disponível no local.
- **Santuários por 180 segundos**: +30% velocidade, +25% multiplicador de dano crítico ou raios reais a cada 2,5 segundos em até três inimigos próximos. Não acumulam multiplicadores. Os buffs locais não alteram os atributos normalizados do PvP.
- **Massacre** com janela renovável de 20 segundos e marcos de 10/25/50/100 mortes: +10/25/50/100% XP e chance de equipamento, limitada a 100%. Cada múltiplo de 50 cria um baú destrutível adiante do herói. Props/baús não contam como mortes. Morte, troca de mapa e entrada em outro modo reiniciam a sequência.
- **Tesouros do Campo**: abrir baús trancados, abrir skins reais da coleção, transformar 50 fragmentos em baú e usar uma pedra de refino em lugar dos cristais, mantendo o custo de ouro e a operação atômica de refino existente. Skins duplicadas retornam 12 fragmentos.

## Densidade e limites

| Região | Pontos físicos | Acampamentos | Depósitos | Ninhos | Santuários | Elites |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Vale de Aster | 98 | 18 | 15 | 16 | 20 | 6 |
| Cemitério/Cripta | 126 | 22 | 24 | 22 | 24 | 6 |
| Cristal Gelado | 136 | 26 | 24 | 24 | 25 | 6 |
| Forja Ardente | 141 | 23 | 27 | 27 | 28 | 6 |
| Abismo | 155 | 29 | 31 | 33 | 23 | 6 |

O catálogo distribui atividades ao longo de rotas em intervalos aproximados de 28 metros; não promete cobertura uniforme de cada metro quadrado. Cada região também tem quadro, duas ruínas obrigatórias, totem de defesa e três posições de fenda. Os 18 spots de caça existentes por região permanecem.

Os props CC0 usam batches `InstancedMesh` de capacidade fixa, são exibidos num raio de 85 m e atualizados a 5 Hz. Até 24 monstros de encontros ficam ativos além do limite ambiente de 54. Ondas reservam a população inteira antes de nascer e aguardam capacidade quando necessário; não se concluem vazias. Guardas distantes são retirados sem abate/recompensa. Fundações e colliders seguem a mesma transformação dos GLBs; passagens no Abismo sustentam os objetivos obrigatórios.

Quatro GLBs Kenney CC0 novos somam 51.744 bytes. Origem fixada por commit, licença e SHA-256 estão em `public/models/pr21/manifest.json`; `scripts/import-pr21-activities.mjs` reproduz a importação. Demais assets reutilizam os catálogos CC0 existentes.

## Persistência e compatibilidade

Campanhas antigas concluídas preservam acesso aos mapas, sem pagar novas recompensas retroativas. Saves parciais preservam contadores/recompensas antigos e passam pelas etapas novas restantes. Créditos de capitães/depósitos/ninhos da história são distintos; contratos repetidos usam tokens persistentes de ocorrência. Recompensas e coleta resistem a repetição do mesmo evento. Contadores, buffs e cooldowns usam tempo de simulação ativo, preservado no save; não avançam com o jogo fechado.

Este conteúdo pertence ao PvE local. Nenhum dado de contrato, drop, simulação ou cheat é importado para contas, carteiras ou pareamento autoritativos do servidor. Nenhum APK ou arquivo Android foi alterado.

## Validação e reprodução

- `npm test`: **345 testes, 46 arquivos**, incluindo 35 casos novos para campanha/migração, contratos ilimitados, encontros reais, defesa, invasões, densidade, limites, buffs, saque, refino e assets.
- `npm run build`: TypeScript e Vite concluídos; permanece o aviso de tamanho do bundle principal.
- Com `npm run dev` em outra sessão: `python3 scripts/smoke-pr21.py`. Requer Playwright Python e Chromium em `/usr/bin/chromium`; `ETERNA_URL` permite outra URL local. Exercita o botão direto da HUD, campanha com 12 etapas, guardas reais, defesa, elites, massacre, loot e resgate de contrato. Resultado: `browser-report.json` e capturas mobile 844×390.
- `python3 scripts/render-pr21.py` renderiza geradores e GLBs de produção em acampamento, elite e fenda. Resultado: `render-report.json` e `world-*.png`, sem erros de shader, página ou carregamento de recursos.

O teste funcional usa god mode/dano direto exclusivamente no desenvolvimento local e substitui o render para limitar o custo. O fixture gráfico separado renderiza de verdade em SwiftShader, sem sombras. As capturas não medem FPS Android nem afirmam desempenho constante em celulares.
