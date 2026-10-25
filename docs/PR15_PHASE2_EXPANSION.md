# PR #15 — Mega Expansão Fase 2: modos locais integrados

## Escopo

**Arena dos Campeões (PvE ranqueado contra IA):** três desafiantes por rodada, classes reais do catálogo, CP variável, sete patamares, cooldowns independentes das quatro skills, movimento tático, esquiva, dash, poção e guarda do inimigo, vida/mana, combo, vitória/derrota com Elo e Honra. Tela própria com modelos GLB de personagens existentes e cenário 3D de Coliseu (colunas Kenney CC0 + plataformas arquitetônicas). **Não é PvP real**, nem modifica `src/online`, partidas humanas ou rating do servidor. Títulos e loja de Honra usam valores locais persistidos.

**Runas/constelações:** quatro nós com pré-requisitos e pontos por nível e Boss. Efeitos aplicados a inimigos reais (dano residual de fogo por tempo, estouro de dash e lâminas extras), além de bônus na fórmula `refreshStats()`. As runas são persistidas.

**Profissões:** nós 3D por região com GLBs Kenney CC0, aproximação, interação, canalização real de 2s e cooldown de respawn. Minerais, ervas, chaves, elixires e cooldown dos nós sobrevivem à viagem entre os cinco mapas; nós esgotados desaparecem até reaparecerem. Mineração, ervas e baús alimentam cinco receitas: dano +30%, XP +50%, velocidade +25%, pedras de refino e chaves. Recursos/temporizadores persistem. Pedras de refino são aplicáveis à arma equipada a partir da aba Coleta, mediante o custo regular de refino; chaves permitem abrir os baús físicos após uma canalização de 2 segundos. A receita da chave utiliza apenas minério e ervas, sem depender de um baú inicialmente trancado.

**Login, sessão e roleta:** calendário de sete dias, um resgate diário, quatro marcos de sessão ativa (5/15/30/60 min), uma roleta por dia; recompensas aplicam ouro, cristais, XP e Honra no modo local. Não contam tempo no fundo (nem simplesmente minimizar a aplicação).

**Mercado NPC simulado:** listagem de duplicatas épicas, lendárias e míticas não equipadas, custódia de itens em anúncio, compra de mercadorias simuladas usando ouro/cristais, taxa 5%, NPCs comprando com atrasos. Diferente da casa de leilão online de jogadores reais; **sem afirmar que bots são jogadores do servidor**.

**Apresentação:** título como Sprite 3D acima do herói, novo painel mobile com aba de arena/runa/coleta/login/mercado/títulos, clima por 5 regiões (pólen, cinzas, neve, faíscas e estrelas/relâmpagos), gestos de rotação e pinça para zoom do modelo 3D de Coleção/Inventário.

## Garantias e ressalvas

- Baseado na `main` pós-PR #13; não toca no servidor online para não criar transações não verificáveis.
- O Coliseu tem arquitetura 3D e assets originais existentes, mas não é um estádio AAA modelado por um artista; métricas de animação, GPU e UX dependem de QA real no Android.
- A IA opera em arena offline com uma simulação real de vida, distância, skills e cooldowns; **não reproduz um segundo cliente humano completo** nem utiliza o sistema de física do mundo aberto.
- A economia simulado/local pode ser modificada pelo proprietário do aparelho; não pode ser usada em trocas online verificadas.
- Recompensas de tempo são progressão opcional sem anúncios e sem compras reais; o usuário pode parar a qualquer momento.
- A prévia por pinça e roda do mouse foi integrada ao renderizador `CharacterPreview` em Coleção, Inventário **e Perfil (PlayerJournal)**, com rotação por arrastar. Outras telas legadas de inspeção de arma podem usar componentes próprios.
- Os objetivos artísticos e de calibração 3D do PR #13 continuam separados e não devem ser chamados de concluídos automaticamente.

## Execução
CI: `npm test` e `npm run build` na branch. Somente após merge do PR #15 em `main` acionar o workflow de APK no GitHub Actions. Não compilar localmente via Gradle.

## Correções após CI inicial

- Eliminado deadlock de fabricação: a Chave Ancestral usa 4 minérios e 3 ervas, sem exigir baú aberto.
- Corrigida persistência inter-regional: recursos e buffs, materiais fabricados, relógio de coleta e cooldowns de cada mapa são transportados ao ativar a nova região e salvos em `phase2.gathering`.
- Vegetação/minerais/baús esgotados têm matrizes de instância ocultadas até o respawn, evitando visual de objeto disponível não coletável.
- Testes de regressão adicionais verificam receitas e integração com `activateMap`.

- O painel de Perfil agora monta e desliga corretamente `CharacterPreview` com classe atual e skin equipada; testes de regressão cobrem o gesto de câmera, host do perfil e descarte do renderizador ao fechar.
