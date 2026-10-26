Os menus usavam glifos dependentes da fonte do celular e painéis planos, e o duelo do Coliseu ficava restrito a um pequeno quadro dentro do modal. Esta mudança apresenta menus com SVGs próprios, vidro fumê, bordas metálicas chanfradas e banners de cenários CC0, e expande o combate para todo o viewport ao selecionar Duelar.

- Coliseu compartilhado entre a apresentação do duelo local e os snapshots da Arena online, com arquitetura GLB Kenney, câmera adaptada a retrato/paisagem, HP e controles nas bordas, sombras e bloom HDR.
- Nove banners WebP de 1280×640 renderizados dos assets CC0 existentes, com fontes, hashes e scripts de reprodução.
- Vegetação rasteira GLB instanciada e reparo de materiais orgânicos sem alterar mapas, colisões ou progressão.
- Gaveta da HUD mantém o botão de menu acessível em telas baixas e em layouts personalizados.

As regras de ArenaSystem, combate, economia, save e recompensas permanecem nas implementações existentes. Duelo contra IA continua identificado como local; a Arena online continua dependendo do servidor e de jogadores conectados.

Validação: `npm test` — 243 testes passando em 40 arquivos; `npm run build` — TypeScript/Vite sem erros. Nenhum APK gerado ou alterado localmente.
