# Eterna · Ninefold

RPG de ação 3D com campanha PvE local e servidor de desenvolvimento para arenas, clãs e mercado, escrito em TypeScript, Three.js e Cannon-es. O mundo, personagens, armas, vegetação, efeitos e texturas são gerados pelo próprio código; não há download de modelos ou assets durante o jogo. Capacitor empacota a mesma aplicação para Android com os assets locais.

## Executar

Requer Node.js 22.12 ou superior; o ambiente foi preparado com Node 24.19.

```sh
npm ci
npm run dev
```

O servidor de desenvolvimento utiliza a porta 5173. Para validar a distribuição:

```sh
npm test
npm run build
npm run preview
```

`build` executa primeiro o TypeScript em modo estrito. Os testes Vitest verificam dano, alcance e projéteis, nove classes, cooldowns, progressão, equipamentos, loot, base, Codex e transições do herói. `preview` serve a compilação na porta 4173.

## Jogar

Clique em **Iniciar jornada**. A vila fica ao sul; siga a estrada ao norte até o portal violeta e use **Interagir** para iniciar a masmorra escolhida em **Jornada**. Cada masmorra tem três andares, ondas e um chefe por andar. Normal, Elite, Pesadelo e Abissal aumentam nível, quantidade de ondas e recompensas. As áreas vermelhas antecipam seus ataques; a esquiva concede invulnerabilidade breve.

| Ação | Desktop | Touch |
| --- | --- | --- |
| Movimento | WASD ou setas | Joystick flutuante à esquerda |
| Câmera | Arrastar à direita | Arrastar à direita |
| Ataque | Segurar J | Segurar Atacar |
| Habilidades | 1, 2, 3, 4 | Quatro botões acima do ataque |
| Pulo / duplo pulo | Espaço, duas vezes | Pular, duas vezes |
| Deslizar / esquiva | Shift | Esquiva |
| Montaria | M | Montaria |
| Interagir / forja / portal | E | Interagir |
| Mergulhar | Segurar Ctrl na água | Segurar Mergulhar na água |
| Inventário / classes / base / Codex | I / C / B / K | Menu inferior |
| Fechar janela | Esc | Botão × |

A escalada começa ao caminhar contra uma parede escalável. Natação e saída da água são automáticas; pular permite voltar à superfície. A montaria exige terra firme. O lobo acompanha o herói, ataca e recolhe tesouros próximos.

As nove classes podem ser trocadas no menu: Berserker, Paladin, Assassin, Ranger, Elementalist, Necromancer, Monk, Lanceman e Warlock. Cada uma possui arma própria, atributos e quatro habilidades. Trocar classe preserva percentuais de vida/mana e as recargas em andamento.

O catálogo contém 144 equipamentos em seis slots e seis raridades, até Mítico. Equipar altera os atributos; aprimorar exige recursos e proximidade da vila. Evoluir os edifícios produz recursos enquanto a simulação está ativa e concede bônus permanentes. O Codex registra derrotas e recompensa coleções. As janelas pausam a simulação.

O progresso é salvo automaticamente no armazenamento local, ao coletar loot e ao sair. Limpar dados do navegador/aplicativo apaga o save PvE. O servidor online mantém seu próprio inventário e moedas; não importa saldos editáveis do cliente. O token de sessão identifica o perfil online deste navegador. Ainda não há recuperação de conta, mundo aberto compartilhado ou hospedagem pública configurada.

## Progressão e sistemas GDD

**Jornada** reúne Epígrafo, troca de classe, inventário/forja, coleção, mapa/GPS, teleportes, dungeons, loja, passe e recursos online. I e C abrem inventário e Epígrafo. A troca de classe ocorre na vila, fora de combate, e conserva vida/mana proporcionais, árvores individuais e recargas.

- Epígrafo: três pontos por nível, cinco nós por classe, reset pago. Além dos atributos base, há penetração, vampirismo, dano mágico ou bônus de companheiro conforme a classe; Espírito reduz recargas até 20%.
- Forja: +1 até +15, com custo e chance exibidos. Falhas consomem recursos e preservam o item. Itens podem ser bloqueados/desmontados; equipamentos têm 1–4 sockets. Rubi aumenta ataque, Safira mana, Esmeralda crítico e Diamante defesa. Fundir três joias Nv.1 cria uma Nv.2; remover ou desmontar recupera as joias.
- Gacha: banners cosméticos de skin, arma, montaria e pet, com probabilidades públicas, garantia Raro+ a cada dez e Lendário+ após sessenta sem Lendário. Duplicatas viram fragmentos. Não concede poder competitivo.
- Economia: ouro/cristais PvE, materiais, fragmentos e diamantes VIP de teste; marcas de arena/clã são controladas exclusivamente pelo servidor. Não há integração com pagamentos ou dinheiro real.
- Teleportes: quatro slots grátis, quatro comprados em sequência e dois ativos durante o VIP. Conjuração de dois segundos e CD de 45 segundos, persistido. Movimento/dano interrompem a conjuração. Gravação/uso são bloqueados perto de chefes, portal, em combate ou durante a masmorra.
- VIP: 30 dias por 25.000 ouro de teste, slots 9/10, 100 diamantes cosméticos e Auto-Farm. A IA seleciona monstros adequados, usa navegação, ataques, magias e poções nos limites configurados; controle manual, morte, dungeon e expiração encerram a automação.
- Passe: 30 níveis por mês UTC, trilhas gratuita/premium, missões diárias/semanais e resgate único. O premium pode resgatar seus adicionais retroativamente.
- Mapa: regiões 1–10, 11–25, 26–40, 41–60, 61–80 e área final 81–100, com monstros e chefes próprios. Clique para marcar GPS ou selecione região/chefe/monstro. A rota A* evita água, inclinações excessivas e colisores; se não houver caminho seguro, o menu informa isso.
- Configurações: idioma PT-BR/EN-US, escala de HUD/controles de 50% a 150%, opacidade, qualidade gráfica e limites das poções. Preferências ficam no save PvE.

## Servidor local: PvP, clãs e mercado

Em outro terminal, na raiz do projeto:

```sh
npm run server
```

O servidor escuta em `127.0.0.1:8787`; Vite e preview encaminham `/api`. Abra **Jornada → Arena** e crie um perfil de desenvolvimento. Use navegadores/perfis distintos para jogadores diferentes. O pareamento exige exatamente 2, 4 ou 6 humanos conectados buscando o mesmo modo; não preenche vagas com bots. Elo controla a faixa de busca e distribuição das equipes. Nível, equipamento e VIP são normalizados para impedir vantagem competitiva. O palco 3D reflete o estado do servidor; golpes, magia, defesa, recarga e energia são autoritativos. Cada jogador pode ativar o próprio modo tático automático após o pareamento.

Clãs têm Líder, Vice-Líder, Ancião, Elite e Membro, transferência de liderança, permissões, bônus de dano da raid, loja com marcas de clã, chefe semanal compartilhado, contribuição de dano e recompensa única por semana. O mercado mantém itens online em custódia, transfere item/moeda atomicamente e cobra 5% do vendedor. Os saldos do PvE local não entram nesse mercado.

Dados persistem em `.cache/online/state.json` (ignorado pelo Git, arquivo privado). Configure `PORT`, `ETERNA_SERVER_HOST`, `ETERNA_SERVER_DATA` e `ETERNA_ALLOWED_ORIGINS` se necessário. No Android, informe em **Jornada → Arena** a origem HTTPS do servidor acessível ao aparelho; `localhost` no telefone não é o computador. O serviço é de desenvolvimento: publicação na Internet requer HTTPS, proteção operacional, backups e autenticação/recuperação de conta adequados. Nenhum serviço público foi publicado por estes comandos.

## Validação adicional

`npm test` cobre os 26 testes originais e os testes de animação, shaders/dados, economia, Epígrafo, sockets, teleporte, passe, Auto-Farm, clã, custódia e matchmaking. `npm run build` inclui TypeScript estrito.

Com o servidor e Vite ativos, `python3 scripts/smoke-online.py` verifica os três modos de fila, compra concorrente, clã e recarga de raid através de HTTP. `python3 scripts/smoke-gdd.py` exige Playwright e Chromium (`ETERNA_CHROME`); verifica os menus em mobile/desktop, idioma, classe, talentos, slots, servidor e shaders do palco da arena. O teste controla os frames para validar em WebGL por software e não mede FPS em celular.

## Renderização e desempenho

O pipeline usa um render target HDR de meia precisão, materiais PBR, sombras CSM de três cascatas, neblina de altura com profundidade, `UnrealBloomPass`, `SMAAPass` e conversão final ACES. O céu procedural combina fases de dispersão Rayleigh/Mie aproximadas, nuvens FBM, disco solar, lua com detalhes de superfície e estrelas. A água usa quatro ondas GLSL com normais analíticas, Fresnel, espuma baseada na altura real do terreno e brilho especular do sol/lua. A reflexão do céu é uma aproximação procedural; não há reflexão planar ou ray tracing.

O terreno mistura grama detalhada, areia úmida nas margens, rocha por inclinação e pavimento da vila/estrada em um shader PBR. Árvores e grama usam `InstancedMesh`. A vila inclui detalhes de carpintaria e alvenaria, moradores em patrulha, tochas animadas e partículas de fogo; a fenda possui um vórtice em espiral. Poeira, folhas e vagalumes acompanham o ciclo dia/noite. A física continua em passos fixos de 60 Hz, compartilhando alturas com a renderização.

**Alta** ativa neblina, bloom, SMAA e sombras de 2048 pixels. **Leve**, padrão para touch, desativa esses pós-efeitos, reduz partículas ambientais, usa resolução menor e sombras de 1024 pixels. A câmera e o mundo continuam 3D. A taxa de quadros depende do aparelho e da GPU; 60 FPS é a meta do loop, não uma garantia de desempenho. Requer WebGL 2 e aceleração gráfica.

## Animação, efeitos e áudio

Herói e inimigos humanoides possuem hierarquias de articulações com antebraços, joelhos, mãos, pés e armadura. Os nove arquétipos têm armas próprias. A animação procedural combina passada oposta, inclinação, amortecimento de pose, escalada, nado horizontal e ataques/conjurações por classe; a capa usa uma malha deformável. As animações de ataque são disparadas apenas quando o combate aceita a ação.

As partículas de combate usam buffers de capacidade fixa: emissão e reciclagem na CPU; movimento, arrasto, gravidade, tamanho e fade no vertex shader. Trilhas de lâmina, estilhaços, faíscas, ondas de choque e pilares de recompensa complementam as habilidades. Esses efeitos não alteram os cálculos de dano, hitboxes ou recargas.

O áudio é sintetizado localmente com WebAudio: cortes, impactos, magia, passos, moedas, rugido e ambiente. Ele é liberado pelo botão **Iniciar jornada**, respeitando a política de gesto do navegador; o Guia permite silenciá-lo. Não há downloads de MP3. A HUD possui emblemas SVG das classes/habilidades, medidores com dano residual e barra do Guardião com fases. Preferências de movimento reduzido são respeitadas nas animações da interface.

## Android

O projeto nativo está em `android/`. Requer **JDK 21 completo**, Android SDK Platform 36 e Build Tools 36.0.0/35.0.0. O instalador fixa o Eclipse Adoptium Temurin 21.0.13+9 e verifica o SHA256 publicado pelo fornecedor. Os componentes oficiais e caches foram preparados neste ambiente de nuvem. Gradle usa o wrapper versionado com verificação SHA256.

```sh
export ANDROID_HOME=/workspace/.android-sdk
export JAVA_HOME=/workspace/.android-sdk/jdk-21
export GRADLE_USER_HOME=/workspace/.cache/gradle
npm run android:debug
```

Em outro Linux x64, use os caminhos do seu JDK/SDK ou execute o instalador `bash scripts/setup-android.sh`. Para instalar fora de `/workspace`, defina `CLOUD_ANDROID_ROOT`, `CLOUD_ANDROID_CACHE` e `GRADLE_USER_HOME` com diretórios graváveis. O instalador verifica os downloads oficiais por SHA256 e aceita as licenças necessárias do SDK. Não versione `android/local.properties`, caches, keystores ou builds.

O APK de desenvolvimento é gerado em `android/app/build/outputs/apk/debug/app-debug.apk`. Ele usa assinatura de depuração. Publicação na Play Store exige uma chave de produção sua, configuração de assinatura e build de release; nenhuma credencial é incluída no código. Os testes de navegador não substituem testes de desempenho e compatibilidade em aparelhos Android físicos.

Após qualquer alteração web:

```sh
npm run android:sync
```

Esse comando recompila e copia o conteúdo de `dist` para o projeto nativo. `npm run android:open` abre o projeto no Android Studio quando há interface gráfica disponível.

## Código

| Diretório | Responsabilidade |
| --- | --- |
| `src/core` | Loop, renderização, eventos, integração e persistência |
| `src/world`, `src/physics` | Mundo procedural, água, colisões, gravidade e superfícies |
| `src/player`, `src/companions` | Herói, estados, câmera, animação, pet e montaria |
| `src/combat`, `src/enemies` | Classes, skills, hitboxes, IA, ondas e boss |
| `src/rpg` | Inventário, loot, níveis, base e Codex |
| `src/ui` | Interface responsiva, controles touch e minimapa |
| `tests` | Testes automatizados da lógica e integração de sistemas |

No modo de desenvolvimento, `window.__ETERNA__` permite inspecionar `diagnostics`, herói e sistemas pelo console. Esse acesso não é incluído na distribuição de produção.
