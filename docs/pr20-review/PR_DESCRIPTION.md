A travessia de portais continuava bloqueada após a campanha, menus congelavam o mundo e limites antigos impediam explorar terrenos maiores. Este PR corrige esses fluxos e amplia os cinco mapas, mantendo o PvP do PR #19.

- Alinha arquitetura, vórtice, barreira e contato da entrada. A conclusão da campanha abre o portal imediatamente; recompensa pendente é resgatada uma única vez na travessia.
- Mantém movimento, física, IA, ambiente e render ativos nos menus, com joystick acessível e pausa explícita no PvE.
- Apoia GLBs usando bounding boxes reais, fundações e colliders sincronizados após carregamento.
- Duplica cada lado dos terrenos (4× de área), amplia limites/GPS/teleportes e distribui 18 spots de caça por região, com respawn próprio e no máximo 54 monstros ambientes residentes.

Validação: `npm test` com 310 testes; `npm run build` concluído. Chromium mobile verificou cinco menus sem pausa, joystick, pausa explícita e travessia real. Os cinco mapas e os portais foram renderizados com os geradores/GLBs de produção; capturas e relatórios em `docs/pr20-review/`. O bundle mantém o aviso de tamanho, sem erro de compilação. As capturas com SwiftShader não medem FPS no Android. Nenhum APK foi compilado ou alterado.

Base de revisão: `feat/pr19-realtime-arena` enquanto o #19 não estiver na main, evitando repetir seu diff. Há 19 casos novos e três contratos antigos atualizados para refletir menus vivos, resolução ampliada do terreno e sombras de folhagem.
