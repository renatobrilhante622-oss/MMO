# PR #19 — Arena PvP em tempo real

O acesso **Arena** abre as filas 1v1, 2v2 e 3v3. Depois de cinco segundos, vagas restantes recebem combatentes identificados como **IA**, com CP entre 92% e 108% do perfil usado no pareamento. Todos os humanos precisam aceitar em três segundos. O servidor aguarda o carregamento de todos antes da contagem 3–2–1.

O Coliseu é carregado na própria cena do Engine, com o renderer, câmera, joystick, ataque, esquiva e quatro habilidades normais. O terreno, NPCs, monstros e efeitos do mundo anterior são removidos. A arena usa os GLBs CC0 Kenney e as texturas PBR já licenciadas no projeto. Possui obstáculos com colisão e linha de visão, pilares destrutíveis por habilidades em área, portões animados, iluminação, telegráficos de habilidades e runas alternadas de cura/poder a cada 30 segundos. O placar inclui HP/mana, cronômetro, dano, eliminações, assistências e cura. Poções Q/E têm duas cargas compartilhadas e cooldown de 12 segundos.

Ao voltar, a região e a posição exata **registradas ao entrar na fila** são restauradas. HP, mana, classe e atributos PvE são preservados na entrada da arena; recursos de coleta e inventário continuam separados do combate PvP. Entrar montado desmonta e recoloca o modelo do herói no seu próprio pivô. Não há respawn PvE, loot PvE, auto-farm, talentos editáveis ou comandos de admin no cálculo do combate online.

## Servidor e contas

Execute `npm run server` e `npm run dev`. O Vite encaminha `/api` para `127.0.0.1:8787`. Na Arena, conecte um perfil antes de procurar partida; para celulares em outra rede, configure uma origem HTTPS pública que encaminhe `/api`, além de `ETERNA_ALLOWED_ORIGINS` no servidor. O APK não conecta ao localhost do computador automaticamente.

O servidor executa uma simulação a 30 Hz; o cliente envia inputs e recebe snapshots a aproximadamente 10 Hz, com interpolação visual. O servidor valida alcance, colisão, linha de visão, cooldown, mana, velocidade, sequências e recompensas. Posição, dano, HP, CP, nível e resultado enviados pelo cliente não são aceitos como autoridade. A classe e o CP online vêm do perfil mantido pelo servidor, **não do save PvE editável**.

As partidas inteiramente humanas são ranqueadas: vitória +25 Elo e 35 marcas de honra; derrota −15 e 10; empate 0 e 10. Partidas com IA são identificadas como treino: resultados vão para `practiceRating`/`practiceHonor`, sem alterar ranking, nível ou moedas competitivas. O botão **Treinar offline com IA** usa outro saldo, `eterna-pvp-practice`, exclusivamente local. Bots nunca são inseridos como contas reais. Isso preserva a separação exigida pelo `AGENTS.md`.

Abandono elimina o combatente; dez segundos sem contato causam eliminação por desconexão. Aceite expirado ou falha de carregamento cancelam sem recompensa. Resultados são aplicados uma única vez por partida e sessões encerradas são removidas após 60 segundos. Reconectar e procurar partida retoma uma sessão ainda ativa. O servidor é de desenvolvimento, de processo único: filas e combates não sobrevivem a reinício; perfis e saldos usam o armazenamento JSON existente. Hospedagem pública, distribuição entre processos e testes de latência em aparelhos continuam etapas de operação.

## Validação reproduzível

- `npm test`: 291 testes, incluindo 25 novos casos de pareamento, combate, segurança e ciclo de cena.
- `npm run build`: TypeScript e Vite concluídos. Permanece um aviso de tamanho do bundle principal; não há erro de compilação.
- `PVP_SERVER=http://127.0.0.1:8791 node scripts/smoke-pr19-online.mjs`: clientes HTTP independentes completam filas humanas nos três modos, validam movimento/habilidades, rejeição de atributos forjados, abandono e recompensa idempotente; também verificam fallback de cinco bots. Use um servidor isolado e dados de teste.
- `PVP_SERVER=http://127.0.0.1:8791 python3 scripts/smoke-pr19.py`: Chromium mobile 844×390 valida lobby, seis cards, carregamento, controles, placar, retorno exato, preservação do inventário de coleta, configuração de servidor estável e combate via transporte online.

As capturas usam SwiftShader e um quadro renderizado em resolução reduzida, com animação avançada explicitamente para limitar custo. São evidência funcional e visual; não medem FPS ou desempenho de rede em Android. Nenhum APK foi gerado ou alterado localmente.

Arquivos: `browser-report.json`, `browser-network-report.json`, `http-report.json` e quatro capturas PNG nesta pasta.
