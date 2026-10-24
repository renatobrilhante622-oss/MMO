# Modelos 3D distribuídos com o jogo

Os arquivos Soldier.glb, Horse.glb e Parrot.glb foram obtidos dos exemplos oficiais de Three.js, sem conversão para geometrias primitivas. As URLs e hashes dos arquivos utilizados estão em `sources.json`. As atribuições e condições dos modelos originais continuam aplicáveis; a licença do runtime Three.js não constitui uma nova licença sobre modelos de terceiros.

- Soldier: personagem humano com esqueleto e clips Idle/Walk/Run; origem do exemplo de animação esquelética do Three.js (modelo Mixamo).
- Horse: cavalo com animação por morph targets, utilizado nas montarias equinas.
- Parrot: ave com animação por morph targets, utilizada na Fênix.

Os arquivos são servidos localmente a partir de `/models/`; o jogo não depende de um CDN em tempo de execução. A aplicação mantém um fallback procedural se o carregamento falhar.
