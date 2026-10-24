# Revisão de UX mobile

Validação em Chromium/WebGL2 por software: 390×844, 844×390 e 1366×768. Os frames do mundo são controlados para permitir automação; estas capturas verificam os menus, não o FPS do jogo. Não houve teste em aparelho Android físico.

- Cabeçalho de 42 px, inventário com três colunas sem rolagem da página, botas/atributos/refino visíveis juntos.
- Botão de Forja dedicado com abas Refino e Sockets; encaixes e ações também cabem em paisagem.
- Filtro de raridade funcional; mochila com rolagem própria.
- Minimapa abre atlas em tela cheia; dez slots presentes, botões de gravação dentro da tela e rota GPS gerada após marcar destino.
- Passe com 100 células (50 gratuitas e 50 premium) e três jornadas com progresso e resgate real.
- Sete controles arrastáveis; escala/opacidade/posição restauradas após recarregar. Arraste por toque nativo emulado no celular e por pointer/mouse; joystick redimensionado conserva a intensidade do movimento.
- Verificação adicional de que os controles iniciais de combate, movimento e menus não cobrem o joystick.

| Tela | Retrato | Paisagem | Desktop |
|---|---|---|---|
| Inventário | [390 px](inventory-390.png) | [844 px](inventory-844.png) | [1366 px](inventory-1366.png) |
| Passe | [390 px](pass-390.png) | [844 px](pass-844.png) | [1366 px](pass-1366.png) |
| Jornadas | [390 px](journeys-390.png) | [844 px](journeys-844.png) | [1366 px](journeys-1366.png) |
| Mapa | [390 px](map-390.png) | [844 px](map-844.png) | [1366 px](map-1366.png) |
| Editor HUD | [390 px](hud-editor-390.png) | [844 px](hud-editor-844.png) | [1366 px](hud-editor-1366.png) |
| Construções | [390 px](base-390.png) | [844 px](base-844.png) | [1366 px](base-1366.png) |
| Bestiário | [390 px](codex-390.png) | [844 px](codex-844.png) | [1366 px](codex-1366.png) |
| Classes | [390 px](classes-390.png) | [844 px](classes-844.png) | [1366 px](classes-1366.png) |
| Forja: refino | [390 px](forge-refine-390.png) | [844 px](forge-refine-844.png) | — |
| Forja: sockets | [390 px](forge-sockets-390.png) | [844 px](forge-sockets-844.png) | — |

Os resultados e o SHA256 do APK estão em [results.json](results.json). O APK passou na verificação de assinatura, integridade ZIP, correspondência dos arquivos web com o build e download HTTP. Os 88 testes e o build TypeScript/Vite passaram; `cap sync android` e `assembleDebug` concluíram com sucesso.
