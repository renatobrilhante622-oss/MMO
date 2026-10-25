# ETERNA — PR #11: Montarias, Asas, Pets e Armas 3D

## Correções de montagem baseadas nos arquivos reais

**Sela:** `CompanionRig.updateSaddleFromGLB()` extrai `Box3`
da instância GLB **carregada** de cada animal, mede a altura após
normalização de escala e posiciona o ponto `mountSaddleNode` em
`Y = bottom + height × 0.78`, com X=0 e Z=0. O valor é convertido
para o espaço local real da montaria (evita multiplicação dupla
ao evoluir e redimensionar a montaria). O cavaleiro mantém o
offset de -0.88m entre pés e quadril; a animação KayKit
`sit_chair_idle` é solicitada quando disponível.

**Pele e armadura:** o animal importado passa a preservar os
materiais e os mapas PBR de cada mesh; a raridade recebe apenas
uma influência suave na cor, sem substituir toda a pelagem por
azul uniforme. Auras e partículas permanecem processadas na GPU.

**Animais sem animação esquelética:** `AnimatedGLB` atualiza um
shader de deformação limitada para respiração, patas e membranas,
enquanto `CompanionRig` interpola o balanço do tronco. O lobo
reproduz suas duas animações de origem. **Isso não equivale a
galope ou voo com ossos articulados.** Para um resultado comercial
é preciso obter os GLBs originais com esqueletos e clipes de
galope, andar, ataque e voo. Os cinco animais GLB estáticos
não foram apresentados como arquivos animados.

**Asas:** em gameplay, o `spine2/chest` do KayKit passa a ser
o pai das asas. O offset é de 0.19m atrás das costas e a escala
é 0.58 da original, com largura máxima de membrana limitada,
bater de asas por pivôs e partículas elementais localizadas.
O preview usa o mesmo sistema `ArticulatedCharacter`.

**Pets:** posição relativa de 1.8m para a direita e 1.2m atrás
no plano do herói, com raio adicional quando a montaria ocupa
um volume real maior. A perseguição a drops/inimigos também
respeita o limite do corpo. O Hellhound usa o lobo GLB real,
mantém pelagem texturizada escurecida, possui fissuras emissivas
animadas por **shader** e brasas coloridas pelo `RarityAura`.
Um Hellhound único com modelo/rig próprios ainda não existe
na base de assets CC0 aprovados.

## Pack de armas 3D e evolução

`src/rpg/WeaponPacks.ts` descreve **45 configurações temáticas
(9 classes × 5 tiers)**. São itens reais: seus visuais de GLB
são exibidos na Coleção e na prévia 3D; também podem aparecer
em drops de chefes, equipar, refinar (+15) e ser salvos.
`visualId` é validado contra a whitelist no carregamento.

**Arte adicional importada:** quatro arquivos oficiais Kenney CC0
com manifesto, fonte original pinada e hash Git verificado:
duas espadas e dois escudos distintos em
`public/models/weapon-packs`. Somam-se às armas
KayKit/Kenney já fornecidas (arco, spear, staff, adagas etc.).
Nenhuma arma geométrica gerada em runtime foi adicionada.
O código libera materiais PBR individuais ao trocar o cosmético.

**Limite de escopo artístico:** cinco opções por classe
não significam cinco esculturas **únicas** de cada tipo:
Assassin, Ranger, Lanceman e conjuradores ainda possuem
malhas de origem reutilizadas com mudanças de material,
efeitos e composições. Para satisfazer literalmente cinco
GLBs separados por classe, será necessária aquisição,
licenciamento, rigging, normalização e incorporação de
outros arquivos externos — a entrega atual é um catálogo
funcional de configurações, não 45 modelos originais.

## Expansão da Coleção

12 novos visuais registrados no catálogo: quatro skins de
personagem, quatro pets e quatro montarias. A equipagem
usa espécies GLB adequadas disponíveis, PBR e efeitos
associados à raridade. Skins de personagem alteram de fato
os materiais do GLB KayKit no mundo e na prévia; novas
modelagens exclusivas de armaduras e mantos ainda dependem
de novos assets originais.

As lojas/gacha que trabalham com a coleção dinâmica recebem
as novas entradas. Não há alteração na autoridade do servidor
online ou em concessões VIP/gemas de forma privilegiada.

## Validação

`tests/pr11-mount-wing-arsenal.test.ts` protege os valores da
sela (Box3 e 78%), acompanhamento dos pets, fixação em spine2,
materiais, fissuras shader do Hellhound, seis classes de raridade,
45 configurações, quatro binários CC0 e seus metadados, loot
de bosses, persistência/forja e integração 3D no jogo/preview.

Para encerrar a **validação visual em APK físico**, testar:
montaria de cavalo/lobo/Wyvern em diferentes escalas, animação
sentada KayKit em todas as nove classes, limites reais da sela,
asas com e sem montaria, pet atacando ou recolhendo drops,
renderização de fissuras do Hellhound e FPS/GPU memory.
Testes TypeScript/Vitest não provam ausência de clipping visual
em todos os Android. APK é produzido por GitHub Actions na
main após merge, não localmente.
