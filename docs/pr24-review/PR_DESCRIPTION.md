## Vozes e história de Eternal Ninefold

NPCs agora falam a missão/saudação no idioma ativo, com perfis vocais distintos e diálogo cinematográfico com transcrição, pular e repetir. A seleção nativa trata vozes tardias e falhas de início; 1.112 gravações formantes locais PT/EN cobrem a campanha e a alternativa offline, inclusive fragmentos dos contratos infinitos. Nenhum TTS remoto é necessário.

As 60 missões recebem a história dos Nove Selos, preservando IDs, objetivos, recompensas e saves. O códice oferece nove capítulos narrados durante a exploração. Configurações salvam volumes de vozes/efeitos/música. Combate, galope, mineração, negociação e música adaptativa usam os estados existentes; impactos respeitam câmera/distância e o pool continua limitado a 40 vozes.

Inclui seta de objetivo nos pés, recuperação por trilha com colisão e recarga, e equipamento melhor com um clique e revalidação do CP do paperdoll. Não muda a economia ou a autoridade do PvP online.

Validação: `npm test` (410 testes / 49 arquivos), `npm run build` (TypeScript + Vite), Chromium 844×390 e 390×844, áudio WebAudio real, capturas e relatórios em `docs/pr24-review/`. Sem compilação Android local ou alteração de APK.

Depende da base do PR23 (`140db2e`). Vozes locais são sintetizadas por formantes, não dublagem humana/neural; volume, áudio suspenso e disponibilidade do dispositivo continuam sob controle da plataforma. Notas e procedência: `public/audio/README.md`.
