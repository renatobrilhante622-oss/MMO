import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {EventBus} from '../src/core/GameTypes';
import {InventoryAndLoot} from '../src/rpg/InventoryAndLoot';
import {forgeComparisonHtml,forgePreview,forgeGemWorkbench} from '../src/ui/ForgeUI';
import {illustratedWings} from '../src/ui/CosmeticIconRenderer';
import {monsterPt,localizeQuestText,npcPortrait} from '../src/ui/NPCDialogUI';
import {QUEST_STORY} from '../src/rpg/QuestSystem';
import {describeLoot} from '../src/ui/LootToastFeed';

describe('Part 2 - real 3D assets and mobile UX',()=>{
 it('bundles six traceable, self-contained CC0 species-specific GLBs',()=>{
   const manifest=JSON.parse(readFileSync(resolve('public/models/creatures/manifest.json'),'utf8')) as
     {assets:Array<{id:string;file:string;license:string;sha256:string;animationCount:number;source:string}>;pending:string[]};
   expect(manifest.assets.map(a=>a.id).sort()).toEqual(['dragon','golem','horse','slime','wolf','wyvern']);
   expect(manifest.pending).toContain('hellhound');
   for(const record of manifest.assets){
     expect(record.license).toBe('CC0-1.0');
     expect(record.sha256).toMatch(/^[a-f0-9]{64}$/);
     expect(record.source.startsWith('https://3dassets.dev/assets/')).toBe(true);
     const b=readFileSync(resolve('public',record.file));
     expect(b.toString('ascii',0,4)).toBe('glTF');
     expect(b.readUInt32LE(4)).toBe(2);
     expect(b.readUInt32LE(8)).toBe(b.length);
     const doc=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString('utf8'));
     expect(doc.meshes.length).toBeGreaterThan(0);
     expect(doc.buffers?.every((x:{uri?:string})=>!x.uri)).toBe(true);
   }
   expect(manifest.assets.find(a=>a.id==='wolf')?.animationCount).toBeGreaterThan(0);
 });
 it('previews exact guaranteed weapon upgrades and 4 functional jewel fusion commands',()=>{
   const inv=new InventoryAndLoot(new EventBus());
   const weapon=inv.items.find(i=>i.slot==='weapon')!;
   const preview=forgePreview(inv,weapon);
   expect(preview.successRate).toBe(100);
   expect(preview.gain.attack).toBe(5*(weapon.level+1));
   expect(preview.gain.defense).toBe(3*(weapon.level+1));
   expect(preview.gain.maxHp).toBe(0);
   expect(forgeComparisonHtml(inv,weapon,true)).toContain('100%');
   const html=forgeGemWorkbench({gems:{ruby:3,sapphire:2,emerald:0,diamond:5},
    greaterGems:{ruby:0,sapphire:0,emerald:1,diamond:0}},weapon,true);
   expect((html.match(/data-do="gem-fuse"/g)||[]).length).toBe(4);
   expect((html.match(/data-do="socket"/g)||[]).length).toBe(4);
   expect(html).toContain('FUNDIR 3:1');
   expect(html).toContain('ENGASTAR');
 });
 it('illustrates six distinct wing styles rather than recoloring identical paths',()=>{
   const pictures=Array.from({length:6},(_,i)=>illustratedWings('epic','Asas','wing-'+i));
   expect(new Set(pictures).size).toBe(6);
   for(const picture of pictures)expect(picture).toContain('wing-illustration');
 });
 it('translates monster tokens and gives different NPCs distinct illustrated portraits',()=>{
   expect(monsterPt('skeleton')).toBe('Esqueleto Guerreiro');
   expect(monsterPt('slime')).toBe('Slime Verde');
   expect(monsterPt('wolf')).toBe('Lobo Cinzento');
   expect(monsterPt('wraith')).toBe('Espectro Sombrio');
   expect(monsterPt('golem')).toBe('Golem');
   expect(localizeQuestText('Derrote skeleton e wolf no cemitério',true)).toContain('Esqueleto Guerreiro e Lobo Cinzento');
   expect(localizeQuestText('Defeat skeleton and wolf',false)).toBe('Defeat skeleton and wolf');
   expect(npcPortrait('guide-crypt')).toContain('<svg');
   expect(npcPortrait('guide-crypt')).not.toBe(npcPortrait('blacksmith-aster'));
 });
 it('keeps real loot events instead of inventing shop currencies in toasts',()=>{
   expect(describeLoot({id:'drop',position:null as never,gold:20,crystals:0,xp:70})?.detail).toContain('+20 Ouro');
   expect(QUEST_STORY.length).toBeGreaterThanOrEqual(15);
 });
});
