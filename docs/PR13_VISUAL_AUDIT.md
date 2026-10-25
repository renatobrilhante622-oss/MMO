# PR #13 — Auditoria visual e reparos no ETERNA (Android)

## Implementado e auditável no código

1. **Árvores** — preservação de `material.map`, `vertexColors` e cores autorais; diferenciação por nomes das sub-malhas/materiais: `woodBark` marrom, `leafsGreen` tons de verde. Emissivo reduzido, sombras de cenário restauradas, ACES exposição 1,15 e PCFSoftShadowMap habilitado. Criadas grama, flores e pedras com `InstancedMesh` e densidade limitada no Android.
2. **Separação Pet/Mount** — seleção central em `companionAssetFor`; pet e montaria **não compartilham nenhum arquivo GLB**. Adicionados 7 GLBs Quaternius CC0; montarias recebem metalwork e cristais 3D importados por arquivo; pets aparecem em escala-base 0,45. A sela é posicionada por amostra `Raycaster` na superfície visível do dorso, com clearance adicional na Wyvern.
3. **Asas** — seis estilos, 3 superfícies curvas por lado, deformação animada de vértices, batimento nos pivôs, `Points` com partículas emissivas e envergadura bastante maior. O ator importado usa escala 1,16, contra 0,58 anterior.
4. **Skins** — cascos/elmos CC0, escudos CC0 como ombreiras, capa de simulação Verlet prendida no osso do tórax e pigmentação de armadura mais visível. Removido o caminho que deixava acessórios dentro da malha procedural invisível do ator.
5. **HUD** — marcadores de mundo z-index 5 e pointer-events none; HUD em camada 30+, pop-ups interativos ainda acessíveis. Coletas no máximo 2 registros com truncamento por linha e distância vertical do joystick.

## Limitações a não ocultar
- Os assets CC0 adicionais incluem um felino usado como familiar do tipo raposa e um dragão estilizado amarelo como base visual do mini-dracolich. **Não são esculturas customizadas de raposa ou dracolich ósseo.**
- Os cavalos da coleção ainda compartilham **alguns modelos-base** (com acessórios diferentes); a solicitação de uma malha inteiramente nova por montaria **não está integralmente atendida**. O PR reduz a repetição com novas malhas de cervo e corcel, além de modelagem 3D CC0 visível nos equipamentos.
- Acessórios importados têm escala, cor e distribuição específicas, mas **não são um set de armadura AAA esculpido sob medida** para cada anatomia.
- Não foi possível validar todas as poses, clipping ou FPS num aparelho Android nesta sessão. `npm test`/`npm run build` e smoke visual precisam ser usados como gates separados; testes unitários não comprovam qualidade AAA nem geometrias perfeitas.

## Fontes/licença
- Quaternius (GLB CC0) via Papyszoo/CC0-Public-Domain-Models, manifesto `public/models/creatures/pr13-visual-assets.json`.
- Elmo e cristais Quaternius RPG CC0; acessórios de placa de escudos Kenney já incluídos no projeto.

## Integração
Código adicionado em PR separado a partir da `main`, sem alterações na branch do PR #12 e sem Gradle local.
