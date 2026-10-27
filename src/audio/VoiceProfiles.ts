export type VoiceArchetype = 'veteran' | 'young' | 'soft' | 'warrior' | 'elder';
export interface VoiceProfile {
  gender: 'male' | 'female';
  pitch: number;
  rate: number;
  voiceArchetype: VoiceArchetype;
  resonance: number;
}
export interface VoiceIdentity {
  name: string;
  title: readonly [string, string];
  profile: VoiceProfile;
  greeting: readonly [string, string];
}
const male = (pitch: number, rate: number, voiceArchetype: VoiceArchetype, resonance: number): VoiceProfile => ({gender:'male', pitch, rate, voiceArchetype, resonance});
const female = (pitch: number, rate: number, voiceArchetype: VoiceArchetype, resonance: number): VoiceProfile => ({gender:'female', pitch, rate, voiceArchetype, resonance});
/** Explicit casting, independent of mesh names, browser voice order and translated labels. */
export const NPC_VOICE_CAST: Readonly<Record<string, VoiceIdentity>> = {
  'guide-aurora': {name:'Eldrin', title:['Guardião da Primeira Dobra','Warden of the First Fold'], profile:male(.88,.91,'veteran',180), greeting:['A Nona Marca voltou a arder. Eu enterrei seu último portador. Desta vez, não confundirei obediência com coragem.','The Ninth Mark burns again. I buried its last bearer. This time I will not mistake obedience for courage.']},
  'guide-crypt': {name:'Morwen', title:['Vigia das Cinzas','Watcher of Ashes'], profile:female(1.12,.87,'elder',550), greeting:['As lápides não guardam inimigos. Guardam os nomes que o Conselho apagou. Escute os mortos antes de julgar os vivos.','These graves hold no enemies. They hold the names the Council erased. Hear the dead before judging the living.']},
  'guide-highlands': {name:'Alaric', title:['Sentinela da Memória','Sentinel of Memory'], profile:male(.94,.98,'young',260), greeting:['O gelo preserva tudo, menos a inocência. Se minha voz mudar, exija que eu lhe mostre a cicatriz da mão esquerda.','Ice preserves everything except innocence. If my voice changes, ask me to show the scar on my left hand.']},
  'guide-rift': {name:'Tharok', title:['Ferreiro do Juramento','Smith of the Oath'], profile:male(.82,.89,'veteran',130), greeting:['Forjei as correntes dos Guardiões. Disseram que protegeriam os selos. Cada martelada minha tornou uma prisão mais forte.','I forged the Wardens’ chains. They said the chains would protect the seals. Every hammer blow made a prison stronger.']},
  'guide-eclipse': {name:'Nyx', title:['Testemunha da Nona Marca','Witness of the Ninth Mark'], profile:female(1.19,.91,'soft',680), greeting:['Você atravessou oito mentiras para chegar aqui. A nona será dita com a sua própria voz. Não acredite no trono.','You crossed eight lies to reach this place. The ninth will be spoken in your own voice. Do not trust the throne.']},
  'merchant-aurora': {name:'Liora', title:['Mercadora dos Peregrinos','Merchant of Pilgrims'], profile:female(1.23,1.02,'soft',720), greeting:['Poções, mapas e um conselho sem preço: um selo não compra a vida de quem o carrega. Escolha o que vai levar.','Potions, maps, and some free advice: no seal can buy its bearer’s life. Choose what you will carry.']},
  'merchant-crypt': {name:'Orin', title:['Contrabandista de Relíquias','Relic Smuggler'], profile:male(.95,1.05,'young',320), greeting:['Os guardas chamam isto de contrabando. Eu chamo de devolver aos mortos o que o Conselho roubou. Precisa de provisões?','The guards call this smuggling. I call it returning what the Council stole from the dead. Need supplies?']},
  'merchant-highlands': {name:'Ylsa', title:['Alquimista Glacial','Glacial Alchemist'], profile:female(1.08,.94,'warrior',470), greeting:['Não toque nos frascos azuis sem luvas. Há memórias presas no cristal, e algumas ainda sabem morder.','Do not touch the blue vials without gloves. Memories live inside the crystal, and some still know how to bite.']},
  'merchant-rift': {name:'Varka', title:['Intendente da Rebelião','Quartermaster of the Rebellion'], profile:female(1.10,1.01,'warrior',410), greeting:['Cada moeda mantém uma família fora das fornalhas. Negocio suprimentos, não lealdade. O que falta na sua bolsa?','Every coin keeps a family out of the furnaces. I trade supplies, not loyalty. What is missing from your pack?']},
  'merchant-eclipse': {name:'Ezra', title:['Arquivista do Limiar','Archivist of the Threshold'], profile:male(.86,.85,'elder',210), greeting:['Aqui o ouro não enferruja e os juramentos não morrem. Traga apenas o necessário. O vazio cobra pelo peso da dúvida.','Here gold never tarnishes and oaths never die. Bring only what you need. The void charges for the weight of doubt.']},
  'blacksmith-aster': {name:'Brom', title:['Mestre da Forja da Aurora','Master of the Dawn Forge'], profile:male(.84,.96,'veteran',150), greeting:['Metal bom não esconde suas rachaduras. Mostre sua arma. Vou reforçá-la sem apagar as marcas do caminho que você escolheu.','Good steel does not hide its cracks. Show me your weapon. I will strengthen it without erasing the marks of the road you chose.']},
  'priestess-aster': {name:'Lyra', title:['Oráculo da Primeira Dobra','Oracle of the First Fold'], profile:female(1.25,.88,'soft',810), greeting:['Não há profecia que obrigue alguém a sofrer. A Nona Marca é uma escolha, não uma sentença. Conheça os selos no códice.','No prophecy can compel someone to suffer. The Ninth Mark is a choice, not a sentence. Learn about the seals in the codex.']},
  'commander-aster': {name:'Kael', title:['Comandante do Coliseu','Commander of the Colosseum'], profile:male(.90,1.02,'warrior',240), greeting:['No Coliseu, as nove ordens lutam sob o mesmo juramento. Vença com habilidade. O adversário de hoje pode guardar suas costas amanhã.','In the Colosseum, the nine orders fight under one oath. Win through skill. Today’s opponent may guard your back tomorrow.']},
  'valkyrie-highlands': {name:'Freya', title:['Valquíria da Última Vigília','Valkyrie of the Last Vigil'], profile:female(1.15,.99,'warrior',490), greeting:['Vigiei este passo durante cem invernos. Não luto por reis. Luto para que ninguém seja esquecido sob esta neve.','I have guarded this pass for a hundred winters. I do not fight for kings. I fight so that nobody is forgotten beneath this snow.']},
};
export const NARRATOR: VoiceIdentity = {name:'A Testemunha',title:['Códice das Nove Dobras','Ninefold Lore Book'],profile:male(.87,.90,'elder',230),greeting:['','']};
export function npcVoice(id:string):VoiceIdentity {return NPC_VOICE_CAST[id] ?? NARRATOR;}
