## Problema e resultado

As skins repetiam modelos/cor e algumas montarias continham somente uma cabeça. O catálogo agora oferece 54 armas em seis grades para as nove classes, seis trajes completos, cinco asas com silhuetas diferentes e cinco montarias de corpo completo. A coleção exibe fontes/custos, bônus e uma prévia 3D com rotação, zoom e teste de animação; as mesmas aparências aparecem equipadas no mundo aberto.

## Mudanças

- GLBs CC0 e composições reais, materiais elementais, energia e mudança de rastros/projéteis para armas Épicas+. Dezenove assets novos otimizados somam 1,68 MB, com origem, licença e hashes registrados.
- Bônus permanentes pela posse única e passivas equipadas reais no PvE: dano a elites/chefes, procs de raio/meteoro com cooldown, roubo de vida, velocidade/escudo ao montar e bônus de contratos. PvP permanece normalizado/autoridade do servidor.
- Essências obtidas em elites, fendas, contratos S/SS, massacres, chefes regionais, Torre e resultados PvP ranqueados. Forja universal permite obter qualquer visual jogando. Crédito/resgate/desbloqueio persistentes e idempotentes; carteiras online separadas.
- Torre da Eternidade adicionada como instância de três andares, nível 35, nas Ruínas de Cristal Gelado. Quatro masmorras e saves antigos preservados.
- Correções de coleta prematura do drop, GLBs unlit, shader com literais negativos e callback de aparência atrasado da montaria. Pegadas em pool fixo de 64 instâncias.

## Validação

`npm test`: **372 testes / 47 arquivos**. `npm run build`: TypeScript/Vite aprovados, com o aviso conhecido do bundle. Chromium mobile validou coleta, desbloqueio/equipamento/salvamento e controles do palco; o fixture gráfico renderizou 22 aparências e o equipamento no mundo aberto sem erros.

Comparações lado a lado, limites e reprodução: [docs/pr22-review/README.md](docs/pr22-review/README.md). As capturas SwiftShader não são um benchmark de FPS Android. Nenhum APK ou arquivo Android foi modificado; o build Android permanece no GitHub Actions.
