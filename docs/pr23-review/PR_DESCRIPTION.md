## Problema e resultado

Trocar aparências mantinha referências de acessórios e podia deixar a geometria da capa sem descarte. Montarias ainda tinham um corpo procedural de fallback; armas não tinham um socket exclusivo, e a coleta abria um painel grande sobre o combate.

Agora skins/armas usam leases de materiais/recursos, descarte de attachments/capa/esqueleto e uma única prévia reutilizada. Cinquenta trocas reais de GLB mantiveram **29 geometrias e 13 texturas**, sem crescimento. O personagem usa um emissor GPU de 32 pontos; não há PointLight/SpotLight anexada às aparências.

- Corpo procedural da montaria removido; todos os modelos de montaria têm skeleton/clips reais. Montar espera o carregamento, troca durante a cavalgada reconecta a sela e desmontar restaura o pai do herói.
- Um `WeaponHandSocket` por mão, limpeza antes de substituir, rejeição de carregamentos antigos e grip/escala normalizados. Skin compatível prevalece sobre equipamento e é salva imediatamente.
- Coleta com botão compacto e canalização de 1,5 s somente em barra de 62×6 px acima da cabeça; avisos em pílulas sem bloquear controles.

## Validação

`npm test`: **390 testes / 48 arquivos**. `npm run build`: TypeScript/Vite aprovados, com o aviso conhecido de bundle. Auditoria WebGL automatizada com 50 trocas e teste Chromium mobile de coleta, equipamento, montagem/troca/desmontagem e avisos. Relatórios, capturas e reprodução em [docs/pr23-review/README.md](docs/pr23-review/README.md).

As medições SwiftShader não são benchmark de FPS Android. APKs e arquivos Android inalterados; o build Android permanece no GitHub Actions.
