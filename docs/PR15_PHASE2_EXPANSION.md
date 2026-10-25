# PR #15 — Mega Expansão Fase 2: modos locais integrados

## Escopo

**Arena dos Campeões (PvE ranqueado contra IA):** três desafiantes por rodada, classes reais do catálogo, CP variável, sete patamares, cooldowns independentes das quatro skills, movimento tático, esquiva, dash, poção e guarda do inimigo, vida/mana, combo, vitória/derrota com Elo e Honra. Tela própria com modelos GLB de personagens existentes e cenário 3D de Coliseu (colunas Kenney CC0 + plataformas arquitetônicas). **Não é PvP real**, nem modifica `src/online`, partidas humanas ou rating do servidor. Títulos e loja de Honra usam valores locais persistidos.

**Runas/constelações:** quatro nós com pré-requisitos e pontos por nível e Boss. Efeitos aplicados a inimigos reais (dano residual de fogo por tempo, estouro de dash e lâminas extras), além de bônus na fórmula `refreshStats()`. As runas são persistidas.

**Profissões:** nós 3D por região com GLBs Kenney CC0, aproximação, interação, canalização real de 2s e cooldown de respawn. Mineração, ervas e baús alimentam cinco receitas: dano +30%, XP +50%, velocidade +25%, pedras de refino e chaves. Recursos/temporizadores persistem. Os itens `refine`/`key` estão registrados no inventário de materiais **ainda sem vinculação automática à forja existente ou aos baús físicos**.

**Login, sessão e roleta:** calendário de sete dias, um resgate diário, quatro marcos de sessão ativa (5/15/30/60 min), uma roleta por dia; recompensas aplicam ouro, cristais, XP e Honra no modo local. Não contam tempo no fundo (nem simplesmente minimizar a aplicação).

**Mercado NPC simulado:** listagem de duplicatas épicas, lendárias e míticas não equipadas, custódia de itens em anúncio, compra de mercadorias simuladas usando ouro/cristais, taxa 5%, NPCs comprando com atrasos. Diferente da casa de leilão online de jogadores reais; **sem afirmar que bots são jogadores do servidor**.

**Apresentação:** título como Sprite 3D acima do herói, novo painel mobile com aba de arena/runa/coleta/login/mercado/títulos, clima por 5 regiões (pólen, cinzas, neve, faíscas e estrelas/relâmpagos), gestos de rotação e pinça para zoom do modelo 3D de Coleção/Inventário.

## Garantias e ressalvas

- Baseado na `main` pós-PR #13; não toca no servidor online para não criar transações não verificáveis.
- O Coliseu tem arquitetura 3D e assets originais existentes, mas não é um estádio AAA modelado por um artista; métricas de animação, GPU e UX dependem de QA real no Android.
- A IA opera em arena offline com uma simulação real de vida, distância, skills e cooldowns; **não reproduz um segundo cliente humano completo** nem utiliza o sistema de física do mundo aberto.
- A economia simulado/local pode ser modificada pelo proprietário do aparelho; não pode ser usada em trocas online verificadas.
- Recompensas de tempo são progressão opcional sem anúncios e sem compras reais; o usuário pode parar a qualquer momento.
- A prévia por pinça e roda do mouse foi implementada no renderizador `CharacterPreview` usado nas telas Coleção/Inventário; não foi confirmado que todas as telas legadas de Perfil/Armas usem o mesmo componente.
- Os objetivos artísticos e de calibração 3D do PR #13 continuam separados e não devem ser chamados de concluídos automaticamente.

## Execução
CI: `npm test` e `npm run build` na branch. Somente após merge do PR #15 em `main` acionar o workflow de APK no GitHub Actions. Não compilar localmente via Gradle.
