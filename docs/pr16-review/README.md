# Revisão visual do PR16

Chromium em 844×390 e 390×844. A revisão confirmou:

- Arena e canvas cobrindo todo o viewport, com dois personagens GLB e cenário CC0 carregados.
- Dash seguido de ataque pelos botões reais: HP do adversário de 1.189 para 1.114.
- Gaveta abrindo e recolhendo pelo mesmo botão, sem cobrir sua âncora.
- Seis abas SVG, banners WebP para masmorras/regiões e materiais de vidro fumê com contornos chanfrados.
- Ausência de rolagem de página e de erros JavaScript/shader nas telas verificadas.

Reprodução opcional: com Vite ativo, Python Playwright e Chromium instalados, execute `python scripts/smoke-pr16.py`. `ETERNA_URL` e `ETERNA_CHROME` ajustam a origem e o executável.

## Capturas

- [Coliseu em paisagem](arena-landscape.png)
- [Coliseu em retrato](arena-portrait.png)
- [Salão da Arena e ícones SVG](arena-lobby-844.png)
- [Masmorras em retrato](dungeons-390.png)

[Relatório de medidas e interação](browser-report.json) · [Descrição pronta do PR](PR_BODY.md).

O teste usou frames controlados e o renderizador de software do ambiente, sem medir FPS em aparelho físico. A captura do mundo aberto foi omitida após timeout de readback; a revisão 3D cobre o Coliseu. O Three.js r186 emite um aviso de compatibilidade ao substituir o antigo `PCFSoftShadowMap` por `PCFShadowMap`; não houve erro de renderização.

`renderer.info.render.calls` é reiniciado entre passes de pós-processamento. O campo de draw calls do relatório representa somente o último passe, e não uma medição do custo total da cena.
