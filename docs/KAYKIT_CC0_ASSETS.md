# ETERNA — ativos KayKit CC0 verificados

Este projeto distribui modelos animados e armas reais, convertidos de fontes oficiais
KayKit sob **Creative Commons Zero v1.0 Universal (CC0-1.0)**.
Não há download em tempo de execução: o Capacitor inclui os GLBs em `public/models/`.

## Proveniência e verificação

- Autor: **Kay Lousberg (KayKit)**.
- Pack de aventureiros: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
  - Commit fixado: `672074b73ba276876a19e8816ecdc5241817ab47`.
  - Licença: `LICENSE.txt` do repositório oficial.
- Pack de esqueletos: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0
  - Commit fixado: `15b62b9bad122f72926c10fb14d622c73819fa54`.
  - Licença: `LICENSE.txt` do repositório oficial.
- Os scripts `scripts/import-kaykit-glb.mjs` e `scripts/import-kaykit-weapons.mjs`
  validam o hash Git SHA-1 **de cada recurso externo** antes de gerar arquivos.
- Os manifestos `public/models/kaykit-manifest.json` e `public/models/kaykit-weapons.json`
  contêm nomes, origens, tamanhos e hashes dos modelos originais.

## Modelos integrados

Os cinco corpos animados são `Barbarian`, `Knight`, `Mage`, `Rogue`
e `Rogue_Hooded`. O runtime os associa às nove classes com
`AnimationMixer` real para idle, caminhada, corrida, esquiva, salto,
ataques específicos da arma, morte e pose sentada na montaria.

Os dois modelos de inimigo `Skeleton_Minion` e `Skeleton_Warrior`
substituem o rig visual criado por geometria para esqueletos e chefe.
Sprites de dano não concedem HP ou drops; o estado do inimigo continua na
lógica original e dispara o evento de dano após `receiveDamage`.

As dez armas/acessórios autênticos são:
`axe_1handed`, `axe_2handed`, `crossbow_2handed`, `dagger`, `quiver`,
`shield_round`, `staff`, `sword_1handed`, `sword_2handed` e `wand`.
O pipeline inclui a textura PNG no próprio GLB. Os equipamentos são
anexados a ossos de mão do personagem. A lógica de inventário e estatísticas
não depende da malha renderizada.

## Limites declarados desta entrega

- **Ainda precisam de GLBs específicos:** lobos, slimes, golems, espectros,
  pets especiais (como Hellhound), montarias diferentes de Horse e asas
  cosméticas. Não declarar essas espécies como migradas antes de incluir
  seus arquivos e conectar animações.
- Algumas classes compartilham o mesmo corpo KayKit; o visual de Ranger
  usa uma besta e o de Lanceman uma espada longa **provisoriamente no
  loadout existente**, até a importação de arco e lança específicos.
- O rig geométrico legado ainda existe no código como suporte a espécies
  não migradas e como mecanismo de testes sem DOM; ele permanece oculto
  na versão browser para heróis e esqueletos migrados.
- `npm test` e `npm run build` verificam a integração de código e
  integridade dos assets. Animações, escala da sela e FPS exigem
  teste no APK em aparelhos Android reais. **60 FPS não é garantido**.
