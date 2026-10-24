# Eterna · Ninefold

RPG de ação 3D individual, escrito em TypeScript, Three.js e Cannon-es. O mundo, personagens, armas, vegetação, efeitos e texturas são gerados pelo próprio código; não há download de modelos ou assets durante o jogo. Capacitor empacota a mesma aplicação para Android com os assets locais.

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

Clique em **Iniciar jornada**. A vila fica ao sul; siga a estrada ao norte até o portal violeta e use **Interagir** para iniciar as três ondas da masmorra. O Guardião aparece depois da terceira onda. As áreas vermelhas antecipam seus ataques; a esquiva concede invulnerabilidade breve.

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

O progresso é salvo automaticamente no armazenamento local, ao coletar loot e ao sair. Use o Guia para apagar o progresso deste dispositivo. Não há conta, servidor, sincronização em nuvem ou multiplayer. Limpar dados do navegador/aplicativo apaga o save.

## Renderização e desempenho

O pipeline combina materiais PBR, ambiente procedural, sombras CSM de três cascatas, ciclo dia/noite, bloom, ACES e neblina de altura integrada em 12 amostras com profundidade. A água usa ondas GLSL e reflexão aproximada do céu com Fresnel; não utiliza reflexos planares completos. Árvores e grama usam `InstancedMesh`. A física é simulada em passos fixos de 60 Hz, com alturas compartilhadas entre terreno visível e colisores.

**Alta** ativa neblina volumétrica, bloom e sombras de 2048 pixels. **Leve**, padrão para touch, remove esses dois pós-efeitos, usa resolução de tela reduzida e sombras de 1024 pixels. A câmera e o mundo continuam 3D. A taxa de quadros depende do aparelho e da GPU; 60 FPS é a meta do loop, não uma garantia de desempenho. Requer WebGL 2 e aceleração gráfica.

## Android

O projeto nativo está em `android/`. Requer **JDK 21 completo**, Android SDK Platform 36 e Build Tools 36.0.0. Os componentes oficiais e caches já foram preparados neste ambiente de nuvem. Gradle usa o wrapper versionado.

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
