# Revisão da reforma da interface

Capturas do Chromium com telas de 844×390 e 390×844. A revisão verificou a gaveta por clique, o mapa com dez slots, as três colunas do inventário, os controles de Refino/Sockets e a separação das telas Loja/Invocação/VIP/Passe. As medidas e os erros do navegador estão em [browser-report.json](browser-report.json).

- [HUD e área de combate](landscape-hud.png)
- [Menu lateral](landscape-drawer.png)
- [Inventário em retrato](portrait-inventory.png)
- [Forja e sockets em paisagem](landscape-forge-sockets.png)
- [Coleção com pedestal](landscape-collection.png)
- [Mercador independente](landscape-shop.png)
- [Fortaleza do clã](landscape-clan.png)

O renderizador do mundo foi pausado no navegador de teste após um frame para evitar saturar a GPU de software do ambiente; os eventos de interface e o preview 3D permaneceram ativos. Estas capturas validam apresentação e interação, sem medir FPS em aparelho físico. Os saldos de teste são locais e não alteram contas do servidor.
