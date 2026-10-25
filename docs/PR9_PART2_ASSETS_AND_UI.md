# ETERNA — Parte 2 (PR #9): Arte CC0, Forja e interface mobile

## GLBs incluídos no APK

Seis modelos **reais**, baixados de fontes imutáveis CC0 na
[3DAssets.dev](https://3dassets.dev/), são distribuídos localmente:
`Creature_wyvern.glb`, `Creature_horse.glb`,
`Creature_wolf.glb`, `Creature_slime.glb`,
`Creature_golem.glb`, `Creature_dragon.glb`.

Manifesto: `public/models/creatures/manifest.json`. Registra URL do modelo,
autor/repositório-fonte, licença CC0, SHA-256, contagem de meshes e animações.
O importador reproduzível está em `scripts/import-cc0-creatures.mjs`.

**Limite da arte:** o lobo tem duas animações embutidas; **Wyvern, cavalo,
slime, golem e dragão são modelos estáticos**. Não prometemos animações
esqueléticas que não existem nesses arquivos. O cavalo clássico continua
disponível em `Horse.glb`. Outros visuais especiais de cavalo reaproveitam
uma base de cavalo real.

**Hellhound:** o catálogo verificado não ofereceu um Hellhound original
adequado. Ele agora usa o modelo real do lobo, com efeitos de raridade
de fogo/colorido, não o boneco de cilindros. **Um GLB exclusivo e
animado do Hellhound continua pendente**.

**Cervo, raposa, Fênix e variantes:** versões distintas também podem
compartilhar temporariamente a silhueta de outra criatura CC0, ao invés
de inventar assets de geometria. Antes do lançamento comercial serão
necessários modelos específicos e validação de animação, pivôs,
escala de sela e direção do personagem no APK Android físico.

`CompanionRig.ts` evita a construção de todas as malhas de boneco
procedural em ambiente browser/Android (a implementação legada permanece
somente para testes sem DOM), criando apenas shaders/partículas,
pontos de montagem e GLBs autorais.

## Forja e Engastes

O cálculo de refino segue o serviço real de inventário:
`ATK +5 × novo nível`, `DEF +3 × novo nível`, HP de item sem
mudança. O upgrade existe até +15, a chance real da transação
permanece **100%**, custos são calculados no inventário, e pedras
de proteção não são cobradas artificialmente.

O layout é de duas colunas em telas largas, com altar rúnico animado,
lista de itens e comparação dos atributos. A aba Sockets expõe
os quatro engastes, respeitando restrições por raridade, quatro
gemas e as ações Engastar, Remover e Fundir 3:1 (todas usando os
eventos já existentes da economia local).

## HUD, NPC e coleção

O Quest Tracker agora pode ser recolhido e possui área definida sob
o painel de vida/mana. O feed de drops não compartilha coordenadas
com a missão. Os cards da coleção são de altura variável, com
quebra de linha para nomes extensos. Seis ilustrações SVG autorais
representam Asas Necróticas, Celestiais, Glaciais, de Magma,
Solares e Astrais.

O diálogo NPC renderiza retratos SVG por personagem, recompensas
de XP/Ouro/Cristais/Tickets/raridade antes da aceitação e usa
tradução explícita de IDs internos: `skeleton`, `slime`,
`wolf`, `wraith` e `golem`.

Loja, Gacha 1×/10×, VIP e Passe continuam separados e preservam
seus fluxos de compra, sorteio, benefícios e missões. CSS desta
entrega impede recortes de texto nos cartões e mantém
ações acessíveis em retrato/paisagem.

## Verificação

`tests/part2-asset-ui.test.ts` verifica o formato dos seis GLBs,
metadados de licença, lógica de refino, quatro gemas com ações reais,
seis SVGs diferentes, tradução e payload de drops.

**Teste visual em aparelho continua obrigatório**: CSS pode ser
compilado sem garantir a ergonomia real em todos os tamanhos de tela.
Nenhum APK foi compilado localmente e nenhuma modificação concede
monedas/benefícios VIP de forma não autorizada.
