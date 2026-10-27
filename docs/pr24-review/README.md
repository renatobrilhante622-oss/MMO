# PR24 — vozes, Nove Selos e exploração

Branch: `feat/pr24-eternal-ninefold-voice-lore`. Base: `140db2e`, PR23. Na verificação desta entrega, `main` ainda estava em `fd58ffb`; o PR24 depende do PR23 e não deve eliminar suas mudanças.

## Uso no jogo

- Converse com qualquer NPC para ouvir a missão/saudação. Há perfis masculinos/femininos explícitos, transcrição progressiva, pular e repetir. Fechar ou trocar a missão cancela fontes, requisições e callbacks antigos. Lyra abre o códice; Kael abre a arena; Freya está nos Picos.
- **Menu → Códice & Bestiário → Abrir Códice Sonoro**: nove capítulos. Voltar ao mundo mantém a narração; a pílula lateral permite interrompê-la.
- **Configurações → Áudio & Vozes**: volumes independentes de vozes, efeitos e música, com salvamento e migração dos saves antigos. O botão de som da HUD acompanha o estado salvo.
- **Configurações → Destravar personagem**: procura a trilha local segura mais próxima, validando colisão, altura e apoio. Recarga de 60 s; indisponível em combate, masmorras, arena e carregamento. Não muda mapas, HP, moeda ou conta online.
- Missão/contrato rastreado e GPS recebem uma seta dourada suavizada no chão. Equipamentos realmente recolhidos, elegíveis e mais fortes geram o botão **Equipar item mais forte (+CP)**; o item é revalidado no clique. O CP exibido usa a mesma função do paperdoll.

## Voz e limites da plataforma

O motor usa uma única instância de fala e compartilha o AudioContext existente. Aguarda brevemente `voiceschanged`, seleciona nomes de voz reconhecidos no idioma correto e aplica pitch/cadência do NPC. A Web Speech API não informa gênero nem oferece saída PCM para conectar a filtros WebAudio. Assim, não se presume gênero pela ordem da lista e não se anuncia processamento de um áudio nativo inacessível.

Quando não há voz adequada, ou a voz nativa não inicia em 1,5 s, o motor cancela essa solicitação e usa gravações formantes locais da frase, com ressonância WebAudio. O cache decodificado é limitado a **12 MiB**; decodificação sequencial evita picos de decoders. Contratos reutilizam fragmentos/números, com pequenas pausas entre eles. Falas do sistema acompanham eventos de palavras quando fornecidos; a alternativa usa o tempo do áudio para estimar o avanço da transcrição.

Não há download de TTS remoto durante o jogo. Reprodução começa por gesto do usuário e respeita mudo, volume, foco e suspensão do aparelho. Não é possível garantir audibilidade em 100% do hardware ou prometer que toda voz instalada seja neural; falhas de áudio deixam a transcrição completa e o gameplay funcionando.

## Preservação de gameplay

As 60 missões conservam seus IDs, requisitos, contadores, objetivos, recompensas e migração. A mudança é de narrativa/localização, com abertura/progresso/conclusão e a história da Guerra das Nove Dobras. Classes, combate, economia, matchmaking e autoridade do servidor não foram substituídos. Sons novos usam o pool existente de 40 vozes, sem novos loops de renderização. Impactos têm atenuação/pan relativos à câmera e silêncio após 45 m. Passos, galope, coleta, magias e música de vila/região/boss/PvP usam os estados reais existentes.

## Validação

- `npm test`: **410 testes, 49 arquivos**, incluindo cobertura das gravações, voz masculina/feminina, vozes tardias, cancelamento, mudo/falha, cache, contratos, saves antigos, colisões de recuperação, seta e equipamento.
- `npm run build`: TypeScript e Vite concluídos. O aviso de tamanho do bundle permanece; não é erro de compilação.
- Chromium com renderização por software, **844×390** e **390×844**: `browser-report.json`. Reprodução real sem vozes nativas instaladas (RMS não nulo), masculino/feminino, PT/EN, pular/repetir/fechar, códice contínuo, três volumes, equipamento +240 CP, recuperação/recarga, seta e nenhuma rolagem de página. Sem erro JS ou gravações HTTP ausentes. Botões do diálogo cabem na área de ações nas duas orientações.
- WebAudio real em página isolada: `audio-report.json` verifica canais independentes, descarte de impacto distante, limite de 40 vozes e limpeza de fontes. Os números medem sinal de áudio, não qualidade artística ou FPS de um Android físico.
- Capturas: `dialogue-{landscape,portrait}.png`, `audio-settings-{landscape,portrait}.png`, `lore-book-{landscape,portrait}.png`.

Não foram executados Gradle, sincronização Android ou geração de APK. Nenhum APK existente foi alterado. A publicação Android permanece no GitHub Actions.
