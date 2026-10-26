/** Creature labels retained for older callers; region travel has no menu UI. */
const PT_MONSTERS:Record<string,string>={
  slime:'Slime Verde',wolf:'Lobo Cinzento',
  skeleton:'Esqueleto Guerreiro',wraith:'Espectro Sombrio',
  golem:'Golem de Gelo',boss:'Chefe Ancestral'
};
export function translatedMonster(kind:string,language:'pt'|'en'):string {
  return language==='pt'?(PT_MONSTERS[kind]??kind):kind[0].toUpperCase()+kind.slice(1);
}
