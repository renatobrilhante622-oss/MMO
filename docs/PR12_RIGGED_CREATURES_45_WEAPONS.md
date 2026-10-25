# PR #12 — ETERNA: malhas CC0, clipes GLB e arsenais

## Entrega verificável
- Arquivos `public/models/weapons/armory-<classe>-<tier>.glb` para as 9 classes × 5 tiers.
- 45 blobs Git distintos, com origem, licença e hash auditável em `public/models/weapons/manifest.json`. Preservados equipagem, preview, raridade, partículas, drop e persistência do PR #11.
- O carregador de armas recebe os novos `WeaponModelId` e normaliza tamanho visual sem gerar geometria no runtime.
- Wolf, DragonEvolved (aparência de wyvern), Dragon e PinkSlime substituem quatro GLBs estáticos por modelos esqueléticos Quaternius CC0 com animações embutidas.
- `AnimatedGLB.findAction` reconhece aliases e prefixos de armature: Walk/Gallop, Flying_Idle/Fast_Flying, Attack/Punch/Bite_Front e Death. Cada instância mantém mixer individual e compartilha os dados de origem.
- O shader de deformação para criatura sem clips ganhou articulação de patas e impulso de ataque. Não é descrito como rig com ossos.
- O PR não executa `./gradlew`: o APK permanece sob GitHub Actions após merge na `main`.

## Limitações artísticas a resolver antes de chamar a tarefa 100% concluída
- **Horse e Golem:** os arquivos atualmente usados não foram substituídos por GLBs com esqueletos e clipes completos. Mantêm deformação Shader (patas/ataque), não um galope/combate capturado com bones.
- **Especificidade das armas:** os 45 blobs são arquivos diferentes, mas os últimos dois cosméticos de Assassin foram importados de espadas curtas/longas; Elementalist usa livro/foco em alguns tiers e Lanceman usa lâminas/machados nos tiers altos. Há cinco visuais distintos por classe, mas ainda não cinco esculturas perfeitamente correspondentes a cada nomenclatura.
- Ausência de prova visual em aparelho físico: ajustar grip, rotação, clipping das mãos, sela, orientação e FPS real por dispositivo após testar APK. Não foi afirmada validação visual no Android.

## Testes
`tests/pr12-rigged-arsenal.test.ts` compara hash Git dos 45 GLBs, verifica 45 caminhos e IDs, valida malhas e pele `skins`/clips dos quatro bichos animados e os aliases do mixer. Workflow `pr12-validation.yml` executa `npm ci`, `npm test` e `npm run build` no runner remoto do GitHub.

## Origem dos assets
- Quaternius (CC0) via <https://github.com/Papyszoo/CC0-Public-Domain-Models>, commit pinado no manifesto.
- Quaternius Wolf/Dragon/PinkSlime (CC0) via <https://github.com/samoylenkodmitry/vibeage>, commit pinado no manifesto.
- KayKit e Kenney CC0 já existentes na `main` do ETERNA, com seus hashes originais preservados no manifesto.
