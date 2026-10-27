# Eternal Ninefold — falas locais PT/EN

`voices/` contém 1.112 gravações mono MP3 (22.050 Hz, 40 kbit/s), cerca de 27,5 MiB. Os nomes derivam do idioma, personagem e texto. `catalog.json` permite auditar cada frase e sua origem.

As gravações foram sintetizadas **offline com eSpeak NG 1.52.0** e normalizadas com FFmpeg. São vozes formantes, não gravações de atores humanos nem um modelo neural. O cliente não precisa desses programas, de um servidor TTS ou de acesso à internet depois da instalação Capacitor. Nenhum executável, biblioteca, modelo ou código do eSpeak é distribuído aqui.

Os textos e os arquivos de áudio desta pasta foram produzidos para o projeto e disponibilizados sob **CC0 1.0**: https://creativecommons.org/publicdomain/zero/1.0/ . O eSpeak NG é uma ferramenta GPL-3.0-or-later; essa licença não se transfere automaticamente à sua saída de áudio. Fontes e licença da ferramenta: https://github.com/espeak-ng/espeak-ng . FFmpeg: https://ffmpeg.org/ . Não há clonagem de pessoas reais.

## Regenerar após editar falas

Em uma máquina com `espeak-ng` e `ffmpeg` instalados:

```sh
npx tsx scripts/generate-voice-assets.ts
```

`NINEFOLD_ESPEAK` pode apontar para o executável. Os arquivos existentes são reaproveitados, frases novas ganham nomes novos e arquivos sem referência são retirados. Para alterar a interpretação de uma frase existente (perfil vocal, velocidade ou parâmetros de codificação), remova sua gravação antes de regenerar e invalide o cache da publicação.

O gerador cobre as três falas de cada missão principal, saudações dos 14 NPCs, nove capítulos, missões secundárias/marcos e fragmentos dos contratos. Nos contratos infinitos, frases e números de 1 a 100 são concatenados; a quantidade máxima vem do sistema existente. O teste de cobertura também verifica caçadas diárias e contratos de serial máximo. A seleção nativa pode usar uma voz local do aparelho quando seu idioma e gênero são reconhecidos.
