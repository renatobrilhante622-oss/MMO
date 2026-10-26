# PR #20 — portais, menus vivos e mundos expandidos

Esta branch parte de `75188a3` (PR #19). Enquanto o #19 não estiver na `main`, a base de revisão é `feat/pr19-realtime-arena`, para que o diff do #20 não duplique a implementação de PvP.

## Correções

- **Portal:** o GLB Kenney `wall-doorway` tem abertura no eixo Z; a arquitetura é rotacionada 90° e normalizada pela bounding box. O vórtice agora ocupa a abertura frontal, com tamanho/altura calculados da estrutura. Retornos ficam orientados para o lado de chegada. Barreira, teste de contato e validação da travessia usam a mesma abertura, evitando aceitar um contato e depois recusá-lo por outra distância.
- **Campanha:** a conclusão dos objetivos principais é a autoridade do portal físico. Nível, lista de regiões em cache e combate recente com o chefe não voltam a selar uma campanha concluída. Um observador atualiza imediatamente a cor verde e a colisão; a recompensa final ainda pendente é resgatada uma única vez ao atravessar. Campanhas incompletas, saltos de capítulos, masmorras e loading continuam protegidos. Teleportes salvos mantêm suas regras próprias.
- **Menus:** a simulação não depende mais de janelas abertas. Herói, física, IA, ambiente, produção/coleta, combate e renderização continuam ativos. O mesmo joystick permanece acessível sobre os menus e mantém o gesto já capturado. Fechar/abrir janelas não apaga movimento ou teclas; soltar o controle interrompe o movimento. A gaveta da HUD continua utilizável. O botão **Pausa** é explícito e exclusivo do PvE; não pausa o servidor PvP. Entrada inicial/seleção inicial e loading continuam isolados.
- **Posicionamento:** uma transformação comum centraliza o pivô X/Z, aplica rotação/escala e apoia o mínimo Y real do GLB no terreno. Fundações niveladas e transições suaves sustentam a arquitetura. Instâncias recebem a mesma matriz usada nas bounding boxes de colisão. Colliders que chegam depois dos GLBs são instalados uma vez, sem duplicar o heightfield nem sobreviver ao unload.
- **Expansão:** cada lado dos cinco terrenos foi duplicado: 720, 800, 840, 880 e 960 metros, quatro vezes a área física anterior. Limites de herói, monstros, GPS, mapa, coleta e teletransportes locais acompanham o tamanho real. A malha/heightfield passa a 256 segmentos nos mundos abertos, preservando a resolução por metro; água e espuma usam a resolução real como uniform. Vila/lago iniciais preservam suas âncoras.
- **Exploração:** 18 spots por região, com seis slots cada, espécie e nível regionais, respawn de 12–18 segundos, clareiras e distribuição pela largura e profundidade. Slimes ficam ao norte da vila e lobos na clareira próxima; esqueletos aparecem na Cripta. No máximo 54 monstros ambientes ficam residentes; criaturas a mais de 115 m são retiradas sem abate/loot e os slots são carregados na aproximação. Chefes mantêm seu respawn separado. Florestas agrupadas, rochedos e ruínas usam GLBs CC0 instanciados e obstáculos físicos. Ilhas/clareiras e passagens no Abismo têm suporte real no heightfield.

O GPS usa heap binário no A*, reduzindo o custo de procurar caminhos nas grades maiores. Não foram adicionados assets sem licença, pacotes, APKs ou alterações Android.

## Validação

- `npm test`: **310 testes em 45 arquivos**, incluindo 19 casos novos.
- `npm run build`: TypeScript e Vite concluídos. Há apenas o aviso já conhecido de tamanho do bundle principal.
- Três contratos antigos foram atualizados conforme os requisitos: menus de gameplay deixam de ser telas de entrada isoladas; a textura de alturas acompanha a resolução do terreno em vez de exigir 129 px; folhagem pequena deixa de exigir sombras dinâmicas. O teste de triangulação agora cobre toda a grade ampliada.
- `python3 scripts/smoke-pr20.py`: Chromium mobile 844×390 confirma a gaveta, caminhada e joystick em cinco menus, IA/tempo/render ativos, pausa/retomada e travessia real com recompensa pendente/combate recente. `browser-report.json` e capturas `live-*`.
- `python3 scripts/render-pr20.py`: renderiza os cinco geradores reais e o portal selado/aberto, verificando orientação e apoio dos colliders. `render-report.json` registra 90–251 obstáculos conforme a região, distribuídos além dos 150 m antigos, e erro de apoio inferior a 0,02 m. As imagens `*-overview` e `aurora-open/sealed` usam assets de produção.

O teste funcional substitui chamadas de render por contadores para limitar custo; a revisão de GLBs renderiza de verdade em SwiftShader, com sombras desativadas no fixture. Esses números e capturas não são um benchmark de FPS em Android. O navegador/SO ainda pode suspender uma aplicação em segundo plano.
