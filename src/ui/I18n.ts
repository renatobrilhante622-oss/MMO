import { CLASS_DEFINITIONS, CLASS_IDS } from '../combat/ClassSystem';
import type { Language } from '../progression/AdventureProgress';
const PAIRS:Record<string,string>={
  '↓ Baixar APK Android':'↓ Download Android APK','Baixar APK Android':'Download Android APK','gloves':'Gauntlets','belt':'Belt','equipment':'Equipment','wing':'Wings','Equipamento':'Equipment','Asas':'Wings','Jornada':'Journey','Inventário':'Inventory','Epígrafo':'Epigraph','Classes':'Classes','Base':'Base','Codex':'Codex','Guia':'Guide','Itens':'Items','Montaria':'Mount','Esquiva':'Dodge','Pular':'Jump','ATACAR':'ATTACK','Atacar':'Attack','Mergulhar':'Dive','Interagir':'Interact','MOVER':'MOVE','SOM':'SOUND','MUDO':'MUTED',
  'Na vila':'In town','Explorando':'Exploring','No ar':'Airborne','Escalando':'Climbing','Nadando':'Swimming','Mergulhando':'Diving','Montado':'Mounted','Retornando à vila':'Returning to town','Salto duplo':'Double jump',
  'VALE DE ASTER':'ASTER VALE','Vale de Aster':'Aster Vale','AMANHECER':'DAWN','LUZ DO DIA':'DAYLIGHT','ENTARDECER':'DUSK','SOB AS ESTRELAS':'UNDER THE STARS','INICIAR JORNADA':'BEGIN JOURNEY','A SAGA DOS NOVE':'THE SAGA OF NINE','UM NOVO MUNDO PARA EXPLORAR':'A NEW WORLD TO EXPLORE','Uma terra ancestral. Nove caminhos.':'An ancient land. Nine paths.','Uma lenda que só você pode escrever.':'A legend only you can write.','9 CLASSES':'9 CLASSES','MUNDO ABERTO':'OPEN WORLD','PROGRESSO LOCAL':'LOCAL PROGRESS','QUALIDADE':'QUALITY','Alta · efeitos completos':'High · full effects','Leve · recomendado para celular':'Low · recommended for mobile','CONTROLES':'CONTROLS','WASD para explorar · Arraste para olhar · J para atacar':'WASD to explore · Drag to look · J to attack','Joystick para explorar · Arraste à direita para olhar':'Joystick to explore · Drag on the right to look','Jogo individual • Sem conta • Salvamento neste dispositivo':'Local PvE • Online arenas in Journey • Saved on this device','No celular, gire a tela para ampliar sua visão.':'On mobile, rotate your screen for a wider view.',
  'Além dos portões':'Beyond the gates','A JORNADA COMEÇA':'THE JOURNEY BEGINS','SEU AVENTUREIRO':'YOUR ADVENTURER','Fechar janela':'Close window','Vida':'Health','Mana':'Mana','GUARDIÃO ANCESTRAL':'ANCIENT GUARDIAN','FASE':'PHASE','VIGÍLIA':'VIGIL','FÚRIA':'FURY','CATACLISMO':'CATACLYSM',
  'Comum':'Common','Incomum':'Uncommon','Raro':'Rare','Épico':'Epic','Lendário':'Legendary','Mítico':'Mythic','Arma':'Weapon','Elmo':'Helmet','Armadura':'Armor','Botas':'Boots','Anel':'Ring','Amuleto':'Amulet',
  'common':'Common','uncommon':'Uncommon','rare':'Rare','epic':'Epic','legendary':'Legendary','mythic':'Mythic','all':'All','equipped':'Equipped','weapon':'Weapon','helmet':'Helmet','armor':'Armor','boots':'Boots','ring':'Ring','amulet':'Amulet','ruby':'Ruby · Attack','sapphire':'Sapphire · Mana','emerald':'Emerald · Critical','diamond':'Diamond · Defense','skin':'Skin','pet':'Pet','mount':'Mount','strike':'Strike','spell':'Spell','guard':'Guard','leave':'Concede','leader':'Leader','officer':'Vice-leader','veteran':'Elder','elite':'Elite','member':'Member',
  'Movimento':'Movement','Câmera':'Camera','Ataque':'Attack','Habilidades':'Skills','Pulo / duplo pulo':'Jump / double jump','Deslizar / esquiva':'Slide / dodge','Inventário / classes / base / Codex':'Inventory / classes / base / Codex','Salvar':'Save','Equipar':'Equip','Equipado':'Equipped','Vender':'Sell','Aprimorar':'Upgrade','Nível':'Level','Ouro':'Gold','Cristais':'Crystals','Defesa':'Defense','Vida máxima':'Maximum health','Qualidade gráfica':'Graphics quality','Limpar progresso':'Clear progress','Cancelar':'Cancel','Confirmar':'Confirm','Voltar':'Back',
  'Explore o vale. Derrote criaturas e encontre o portal ao norte.':'Explore the vale. Defeat creatures and find the portal to the north.','Sobreviva às ondas. Evite as áreas vermelhas do Guardião.':'Survive the waves. Avoid the Guardian’s red zones.','O portal desperta. Toque em Interagir para começar o desafio.':'The portal awakens. Interact to start the challenge.','Sua jornada começou. Explore o vale ao norte da vila.':'Your journey has begun. Explore north of the village.','Mana insuficiente. Aguarde a regeneração.':'Not enough mana. Wait for regeneration.','Encontre terra firme para invocar sua montaria.':'Find dry ground to summon your mount.','Montaria invocada · velocidade aumentada':'Mount summoned · increased movement speed','Montaria dispensada':'Mount dismissed',
};
Object.assign(PAIRS,{
  'Vila Aurora':'Dawn Village','Lago Espelhado':'Mirror Lake','Fenda do Vazio':'Void Rift','Guardião do Vazio':'Void Guardian',
  'Portal da masmorra · aproxime-se e interaja':'Dungeon portal · approach and interact',
  'Forja da Aurora':'Dawn Forge','Torre de Alquimia':'Alchemy Tower','Estábulo dos Guardiões':'Guardian Stables','Mina de Âmbar':'Amber Mine',
  '+3 ataque por nível. Os ferreiros fortalecem suas armas.':'+3 attack per level. Blacksmiths strengthen your weapons.',
  '+14 vida por nível. Produz cristais a cada 40 segundos por nível.':'+14 health per level. Produces crystals every 40 seconds per level.',
  '+2 defesa e +6 vida por nível. Equipamentos de proteção para a expedição.':'+2 defense and +6 health per level. Protection for your expedition.',
  'Produz 0,8 ouro por segundo por nível, enquanto a expedição está ativa.':'Produces 0.8 gold per second per level while the expedition is active.',
  'Gosma do Bosque':'Forest Slime','Lobo Cinzento':'Grey Wolf','Sentinela Esquelética':'Skeletal Sentinel','Golem de Pedra':'Stone Golem','Espectro do Eclipse':'Eclipse Wraith','Colosso da Fenda':'Rift Colossus',
  'Essências vivas que absorvem a energia das raízes.':'Living essences absorbing energy from the roots.',
  'Caçadores velozes das clareiras de Aetheria.':'Swift hunters of Aetheria’s clearings.',
  'Os guardas esquecidos de um reino perdido.':'Forgotten guards of a lost kingdom.',
  'Fragmentos da montanha animados por magia antiga.':'Mountain fragments animated by ancient magic.',
  'Espíritos que guardam o caminho para o portal.':'Spirits guarding the road to the portal.',
  'Um titã de múltiplas fases que comanda a masmorra.':'A multi-phase titan commanding the dungeon.',
  'Forja da vila: equipe, venda ou aprimore seu equipamento.':'Village forge: equip, sell or upgrade your gear.',
  'Encontre a vila para usar a forja ou o portal ao norte para desafiar a masmorra.':'Find the village forge or challenge the dungeon at the northern portal.',
  'Volte à forja da vila para aprimorar equipamentos.':'Return to the village forge to upgrade equipment.',
  'Você despertou na vila. O resgate custou 10% do ouro.':'You awoke in the village. Rescue cost 10% of your gold.',
  'O vale desperta. Explore a vila, encontre inimigos e procure o portal ao norte.':'The vale awakens. Explore the village, find enemies and seek the northern portal.',
  'Desafio da masmorra · preparando a primeira onda':'Dungeon challenge · preparing the first wave',
  'Desafio interrompido · retorne ao portal para tentar novamente':'Challenge interrupted · return to the portal to try again',
  'O desafio terminou. Seu progresso de personagem foi preservado.':'The challenge ended. Your character progress was preserved.',
  'O Guardião do Vazio despertou. Saia das áreas vermelhas!':'The Void Guardian awakened. Leave the red zones!',
  'Masmorra concluída · o Guardião foi derrotado':'Dungeon completed · the Guardian was defeated',
  'Vitória! O Guardião caiu. Recolha seu tesouro e retorne à vila.':'Victory! The Guardian fell. Collect your treasure and return to town.',
  'Arraste para mover a câmera':'Drag to move the camera','Joystick: arraste para caminhar':'Joystick: drag to walk','Segure para mergulhar na água':'Hold to dive in water',
  'Áudio procedural':'Procedural audio','Silenciar áudio':'Mute audio','Ativar áudio':'Enable audio','Minimapa em tempo real':'Live minimap','Progresso salvo automaticamente neste dispositivo':'Progress automatically saved on this device',
});
const PT_SERVER:Record<string,string>={
  'strike':'Golpear','spell':'Conjurar','guard':'Defender','leave':'Desistir','tactical':'Modo tático automático',
  'Traveler crest':'Emblema do Viajante','Weekly guardian crest':'Emblema do Guardião Semanal','Clan guardian crest':'Emblema do Guardião do Clã',
  'No active match.':'Nenhuma partida ativa.','Session required.':'Sessão necessária.','Session not found.':'Sessão não encontrada.',
  'Action unavailable or cooling down.':'Ação indisponível ou em recarga.','Insufficient energy.':'Energia insuficiente.',
  'Join a clan first.':'Entre em um clã primeiro.','Already in a clan.':'Você já está em um clã.','Clan full or unavailable.':'Clã cheio ou indisponível.',
  'Clan creation costs 50 arena marks.':'Criar um clã custa 50 marcas de arena.','Clan name already taken.':'Nome de clã já utilizado.',
  'Clan name must contain 3–28 letters or numbers.':'O nome do clã precisa de 3–28 letras ou números.',
  'Use 3–24 letters or numbers for your name.':'Use de 3 a 24 letras ou números no nome.',
  'Transfer leadership before leaving.':'Transfira a liderança antes de sair.','Leave your current clan first.':'Saia do clã atual primeiro.',
  'Weekly boss defeated.':'Chefe semanal derrotado.','Raid attack cooldown: 30 seconds.':'Recarga do ataque de raid: 30 segundos.',
  'Requires 100 clan marks.':'Requer 100 marcas de clã.','Officer permission required.':'Requer permissão de oficial.',
  'Insufficient clan marks or maximum level.':'Marcas de clã insuficientes ou nível máximo atingido.',
  'Listing unavailable or insufficient marks.':'Anúncio indisponível ou marcas insuficientes.','Listing not owned.':'Você não é o dono do anúncio.',
  'Online inventory full.':'Inventário online cheio.','Maximum 10 listings.':'Máximo de 10 anúncios.','Item unavailable.':'Item indisponível.',
  'Price must be 5–10000 marks.':'O preço deve ser de 5 a 10.000 marcas.','Too many requests.':'Muitas solicitações; aguarde alguns segundos.',
  'Finish your current match.':'Termine sua partida atual.','Connection failed.':'Falha na conexão.','Failed to fetch':'Não foi possível acessar o servidor.',
  'Arena started. All gear, levels and VIP bonuses normalized.':'Arena iniciada. Equipamentos, níveis e bônus VIP normalizados.',
  'Draw.':'Empate.',
};
const descriptions=[
  'Brutal axe. Heavy combos and area control.','Sacred sword. Strong armor and restorative healing.','Swift daggers. Critical strikes and precision attacks.','Precision bow. Master of ranged combat.','Elemental staff. Fire, frost and storms.','Ritual scythe. Drain life and master souls.','Jade fists. Fast rhythm and vital energy.','Long spear. Reach and devastating thrusts.','Void orb. Curses and arcane power.',
];
const skills=[
 ['Seismic Cleave','A frontal cleave that pushes enemies away.'],['Whirlwind','Sweep your blade around the warrior.'],['Blood Rage','A violent rupture restores part of your health.'],['Celestial Axe','A burning wave pierces the front line.'],
 ['Judgment','Sacred light strikes enemies ahead.'],['Sanctuary','A circle of light restores 35% health.'],['Radiant Lance','Fire a lance of light with an explosive impact.'],['Divine Verdict','Consecrate a wide area and recover vitality.'],
 ['Shadow Cut','A flurry of blades strikes targets ahead.'],['Venom Star','A poisoned star explodes on contact.'],['Death Blossom','Daggers strike all surrounding enemies.'],['Nightfall','A shadow wave inflicts devastating critical damage.'],
 ['Piercing Arrow','A fast, long-range projectile.'],['Multishot','A volley covers the cone ahead.'],['Forest Pulse','Natural energy repels nearby enemies and heals.'],['Starfall Arrow','An explosive arrow strikes a broad area.'],
 ['Fireball','A burning sphere explodes on impact.'],['Frost Nova','Ice crystals burst around you.'],['Storm Wave','Lightning strikes a long frontal cone.'],['Cataclysm','The elements unleash a massive explosion.'],
 ['Soul Reap','The scythe steals vitality from enemies ahead.'],['Spectral Plague','A pestilent sphere detonates on impact.'],['Grave Circle','Ancestral energy strikes nearby enemies.'],['Final Harvest','Reap the entire area and restore 40% health.'],
 ['Tiger Palm','A focused strike with powerful knockback.'],['Dragon Breath','Flaming energy surges in a cone.'],['Inner Balance','Restore health while repelling threats.'],['Thousand Fists','A chi explosion strikes all nearby foes.'],
 ['Impale','A long-reaching thrust.'],['Sweeping Lance','The spear sweeps around the hero.'],['Thunder Javelin','An electric throw with tremendous impact.'],['Dragon Spear','A draconic explosion channels your full power.'],
 ['Void Bolt','A shadow projectile travels a long distance.'],['Hellfire','Supernatural flames engulf nearby foes.'],['Life Tap','Drain energy and recover health.'],['Singularity','A void star creates a tremendous explosion.'],
];
let index=0;CLASS_IDS.forEach((id,i)=>{const c=CLASS_DEFINITIONS[id];PAIRS[c.description]=descriptions[i];for(const skill of c.skills){PAIRS[skill.name]=skills[index][0];PAIRS[skill.description]=skills[index++][1];}});
const PT_INTERNAL:Record<string,string>={equipment:'Equipamento',wing:'Asas',common:'Comum',uncommon:'Incomum',rare:'Raro',epic:'Épico',legendary:'Lendário',mythic:'Mítico',all:'Todos',equipped:'Equipados',weapon:'Arma',helmet:'Elmo',armor:'Armadura',boots:'Botas',ring:'Anel',amulet:'Amuleto',gloves:'Manoplas',belt:'Cinto',ruby:'Rubi · Ataque',sapphire:'Safira · Mana',emerald:'Esmeralda · Crítico',diamond:'Diamante · Defesa',skin:'Skin',pet:'Mascote',mount:'Montaria',strike:'Golpear',spell:'Conjurar',guard:'Defender',leave:'Desistir',leader:'Líder',officer:'Vice-Líder',veteran:'Ancião',elite:'Elite',member:'Membro'};
export function translateText(text:string,language:Language):string {
  if(language==='pt')return PT_INTERNAL[text]??PT_SERVER[text]??text.replace(/^Team (\d+) won\.$/,'Equipe $1 venceu.').replace(' conceded.',' desistiu.').replace(' guards.',' defende.');
  if(PAIRS[text])return PAIRS[text];
  const item=text.match(/^(Lâmina|Elmo|Couraça|Botas|Anel|Amuleto|Manoplas|Cinto)( Temperado| Rúnico| Celestial)? (do Viajante|do Bosque|da Aurora|do Eclipse|dos Antigos|da Eternidade)$/);
  if(item){const slot:Record<string,string>={'Lâmina':'Blade','Elmo':'Helm','Couraça':'Cuirass','Botas':'Boots','Anel':'Ring','Amuleto':'Amulet','Manoplas':'Gauntlets','Cinto':'Belt'};const tier:Record<string,string>={' Temperado':'Tempered ',' Rúnico':'Runic ',' Celestial':'Celestial '};const suffix:Record<string,string>={'do Viajante':'of the Traveler','do Bosque':'of the Grove','da Aurora':'of Dawn','do Eclipse':'of the Eclipse','dos Antigos':'of the Ancients','da Eternidade':'of Eternity'};return `${tier[item[2]]??''}${slot[item[1]]} ${suffix[item[3]]}`;}
  const bonus=text.match(/^\+(\d+) (vida|ataque|defesa) a cada (\d+) derrotas \(máx\. 5 coleções\)$/);
  if(bonus)return `+${bonus[1]} ${{vida:'health',ataque:'attack',defesa:'defense'}[bonus[2]]} per ${bonus[3]} defeats (max 5 collections)`;
  const itemAction=text.match(/^(.+) (encontrado|equipado)$/);if(itemAction)return translateText(itemAction[1],language)+(itemAction[2]==='encontrado'?' found':' equipped');
  const classMessage=text.split(': ');if(classMessage.length===2&&PAIRS[classMessage[1]])return classMessage[0]+': '+PAIRS[classMessage[1]];
  return text.replace(/^Nível (\d+)! Seus atributos aumentaram\.$/,'Level $1! Your attributes increased.').replace(/^Desafio da masmorra · Onda (\d+)$/,'Dungeon challenge · Wave $1').replace(/^FASE (\d+) · /,'PHASE $1 · ').replace('VIGÍLIA','VIGIL').replace('FÚRIA','FURY').replace('CATACLISMO','CATACLYSM').replace(/^Onda (\d+) concluída · próxima em (\d+)s$/,'Wave $1 cleared · next in $2s').replace(/^Onda (\d+) \/ (\d+) · (\d+) inimigos restantes$/,'Wave $1 / $2 · $3 enemies remaining').replace(/^Onda (\d+) · (\d+) criaturas atravessaram o portal\.$/,'Wave $1 · $2 creatures crossed the portal.').replace('Guardião do Vazio · Fase','Void Guardian · Phase').replace('Guardião · Fase','Guardian · Phase').replace('ondas / waves','waves');
}
/** Restore source text on a language switch; observe new dialog/menu content too. */
export class GameI18n {
  private observer:MutationObserver;
  private sources=new WeakMap<Text,{source:string;rendered:string}>();
  private attributes=new WeakMap<HTMLElement,Record<string,{source:string;rendered:string}>>();
  constructor(private readonly root:HTMLElement,private language:Language){this.observer=new MutationObserver(()=>this.paint());this.observe();this.paint();}
  private observe():void{this.observer.observe(this.root,{childList:true,subtree:true,characterData:true});}
  set(language:Language):void{this.language=language;document.documentElement.lang=language==='pt'?'pt-BR':'en-US';this.paint();}
  private paint():void {
    this.observer.disconnect();
    const walker=document.createTreeWalker(this.root,NodeFilter.SHOW_TEXT);let node:Node|null;
    while((node=walker.nextNode())){const text=node as Text;if(text.parentElement?.closest('script,style,.adventure-layer'))continue;const prior=this.sources.get(text),source=prior&&text.data===prior.rendered?prior.source:text.data;const trimmed=source.trim(),translated=translateText(trimmed,this.language),rendered=source.replace(trimmed,translated);this.sources.set(text,{source,rendered});if(text.data!==rendered)text.data=rendered;}
    this.root.querySelectorAll<HTMLElement>('[aria-label],[title],[placeholder]').forEach(el=>{
      if(el.closest('.adventure-layer'))return;
      const record=this.attributes.get(el)??{};
      for(const key of ['aria-label','title','placeholder']){const value=el.getAttribute(key);if(value===null)continue;const prior=record[key],source=prior&&value===prior.rendered?prior.source:value;const rendered=translateText(source,this.language);record[key]={source,rendered};if(value!==rendered)el.setAttribute(key,rendered);}
      this.attributes.set(el,record);
    });
    this.observe();
  }
  dispose():void{this.observer.disconnect();}
}
