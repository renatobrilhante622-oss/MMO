# Reforma visual — revisão no Chromium

Screenshots geradas por `python3 scripts/smoke-visual.py` nos viewports 1440×1080 e 390×844. O cenário usa uma fixture local de nível 12, com pontos investidos e joias para testar a interação. Não são imagens conceituais: o navegador capturou o jogo em execução.

- [Inventário com paperdoll e oito slots](inventory-1440.png)
- [Forja com joia engastada](forge-1440.png)
- [Constelação com conexões acesas](constellation-1440.png)
- [Coleção com preview 3D](collection-1440.png)
- [Atlas com relevo, símbolos e GPS](atlas-1440.png)
- [Cenário 3D e HUD sem nomes de skills sobrepostos](world-1440.png)
- [Inventário mobile](inventory-390.png)
- [Forja mobile](forge-390.png)
- [Constelação mobile](constellation-390.png)
- [Atlas mobile](atlas-390.png)

O teste confirma ausência de cartões de texto nas três telas reformadas, oito slots reais, seleção, refino e engaste, conexões da constelação, atlas de 1120×1120 e ausência de erros JavaScript/GLSL. As animações de interface são congeladas nas capturas para comparação. O frame do mundo usa renderização por software em qualidade Leve, resolução interna reduzida e sombras desabilitadas **somente no teste**; as opções gráficas do aplicativo permanecem disponíveis. Não é um benchmark de desempenho nem um teste em Android físico.
