# PR #10 — Abertura cinematográfica, nove classes e HUD segura

## Fluxo de navegação

O aplicativo cria uma única cena 3D e inicia uma intro com câmera real
percorrendo os cenários GLB, os portais e o dragão GLB. A overlay de
cinema usa barras letterbox, partículas douradas, narrativa com fade
e um botão acessível de pular. Duração: 11 segundos, ou salto imediato
se a preferência de acessibilidade para movimento reduzido estiver ativa.

Ao terminar, a câmera retorna ao herói. A única tela de título
`ETERNA — INICIAR JORNADA` é a do `MobileHUD`; a segunda tela de
`TOQUE PARA INICIAR` foi removida do bootstrap. A HUD, Quest Tracker,
marcadores de NPC e portais, mini mapa, ferramentas de jogador e
atalhos de masmorra não aparecem durante intro ou menu. A fase
`playing` é liberada somente ao pressionar `INICIAR JORNADA`.
O link de download de APK no próprio aplicativo foi removido
do HTML em vez de apenas escondido por CSS.

**Nota técnica:** trilha de áudio automática não foi adicionada
porque navegadores e WebViews bloqueiam reprodução audível antes de um
gesto do usuário; o áudio pode ser desbloqueado ao iniciar a jornada.

## Classes e armas

- `clearWeaponSlots` percorre toda a hierarquia importada e oculta
  malhas incorporadas cujos nomes correspondem a bow, crossbow,
  quiver, dagger, sword, staff, shield, mug, axe, wand ou spear.
  Ossos, slots e transforms da animação continuam intactos.
- Assassin: **duas adagas**, em sockets independentes das mãos.
- Ranger: **arco real Kenney CC0** na mão esquerda e **aljava**
  KayKit real nas costas. O arco é bundlado com seu atlas PNG.
- Paladin: espada e escudo; Berserker: machado de duas mãos;
  Elementalist: staff com grimório aberto real;
  Necromancer: staff com grimório fechado real;
  Monk: desarmado; Lanceman: lança Kenney real;
  Warlock: wand e staff.
- As nove classes possuem perfis exclusivos de cor e combinação de
  modelos de armas reais. Suas identidades são independentes de skins:
  uma skin `forest` não converte Assassin em Ranger_Hooded.
- **Limite de arte:** o acervo ainda contém cinco malhas-base KayKit
  de personagens, e não nove esculturas totalmente independentes.
  Os nove perfis têm classes, acessórios e cores distintos, mas
  acessórios premium exclusivos de cabeça/costas/ombros exigirão
  arquivos licenciados específicos para cada classe.

## Interface e iluminação

- Atalhos `PORTAIS` e `MASMORRAS` são registrados no menu expansível
  do canto superior direito; nenhuma regra fixa pode ocupar os botões
  de skill ou joystick.
- Portais mostram placas somente quando a distância horizontal
  ao jogador é menor que 18 metros e a posição projetada está
  dentro da área segura da câmera.
- Texto de missões quebra linha com `line-height:1.35` e altura
  automática, sem cortes horizontais.
- Vegetação importada real usa `metalness=0`, `roughness=.85`,
  preenchimento emissivo suave, luz ambiente hemisférica e mínimo de
  difusão por canal. Texturas originais permanecem no material.

## Testes de engenharia

`tests/pr10-cinematic-weapons.test.ts` valida: exclusão recursiva
de armas incorporadas sem esconder ossos, loadouts das nove classes,
equipamentos e aljava, integridade do arco e PNG CC0, ausência de
segunda tela/título e download APK, isolamento CSS de menu,
limite de 18 metros e iluminação de vegetação.
`tests/real-environment.test.ts` também valida que skins não alteram
o modelo-base da classe.

**Aceitação real no Android:** ainda é necessário instalar o APK do
merge, testar o enquadramento da câmera na intro, a legibilidade em
retrato/paisagem, orientação e escala dos acessórios nos ossos KayKit,
recebimento de dano e uso de skills com as nove classes, assim como
renderização de árvores em GPUs Android distintas. Testes TS/Vitest
não demonstram que todos esses ajustes visuais foram concluídos.

**Fora deste PR:** sela/texturas das montarias, proporção das asas,
pets e novos pacotes de skins/itens: PR #11.
