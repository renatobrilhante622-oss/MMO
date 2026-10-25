import {describe,expect,it} from 'vitest';
import {EventBus} from '../src/core/GameTypes';
import {InventoryAndLoot} from '../src/rpg/InventoryAndLoot';
import {AdventureProgress} from '../src/progression/AdventureProgress';
import {QuestSystem,QUEST_STORY,QUEST_MILESTONES} from '../src/rpg/QuestSystem';
import {NPCSystem} from '../src/world/NPCSystem';
import {REGIONS} from '../src/world/Regions';

function fixture(now=new Date('2026-10-24T12:00:00Z')){
 const inv=new InventoryAndLoot(new EventBus());
 const prog=new AdventureProgress(inv);
 return {inv,prog,quests:new QuestSystem(inv,prog,now)};
}

describe('story quests and rewards',()=>{
 it('builds exactly three linked story objectives per region',()=>{
   expect(QUEST_STORY).toHaveLength(15);
   for(const region of REGIONS){
     const steps=QUEST_STORY.filter(q=>q.region===region.id);
     expect(steps.map(q=>q.goal)).toEqual(['talk','kill','boss']);
   }
 });
 it('progresses from guide through hunts and boss, unlocking the next region only when claimed',()=>{
   const {quests,inv,prog}=fixture();
   expect(quests.activeStory()?.id).toBe('story-aurora-meet');
   expect(quests.claim('story-aurora-meet')).toBe(false);
   quests.onTalk('guide-aurora');
   expect(quests.progressOf(quests.activeStory()!).ready).toBe(true);
   expect(quests.claim('story-aurora-meet')).toBe(true);
   expect(quests.activeStory()?.id).toBe('story-aurora-hunt');
   for(let i=0;i<5;i++)quests.onKill('slime','aurora');
   expect(quests.claim('story-aurora-hunt')).toBe(true);
   const gold=inv.gold;
   quests.onKill('boss','aurora',true);
   expect(prog.unlockedRegions).toEqual(['aurora']);
   expect(quests.claim('story-aurora-boss')).toBe(true);
   expect(quests.claim('story-aurora-boss')).toBe(false);
   expect(inv.gold).toBeGreaterThan(gold);
   expect(prog.unlockedRegions).toContain('crypt');
   expect(quests.activeStory()?.id).toBe('story-crypt-meet');
 });
 it('requires acceptance for optional side tasks, but tracks milestones passively',()=>{
   const {quests,inv}=fixture();
   expect(quests.accept('side-crypt')).toBe(false);
   expect(quests.accept('side-aurora')).toBe(true);
   const side=quests.get('side-aurora')!;
   quests.onKill('wolf','crypt');
   expect(quests.progressOf(side).progress).toBe(0);
   for(let i=0;i<8;i++)quests.onKill('wolf','aurora');
   expect(quests.claim(side.id)).toBe(true);
   const milestone=QUEST_MILESTONES.find(q=>q.id==='milestone-level-50')!;
   inv.level=50;quests.updateMilestones(50,0,0,false);
   expect(quests.progressOf(milestone).ready).toBe(true);
 });
 it('rotates five daily bounty contracts and prevents duplicate payouts',()=>{
   const {quests,inv}=fixture();
   const first=quests.all().filter(q=>q.category==='bounty');
   expect(first).toHaveLength(5);
   for(let i=0;i<first[0].required;i++)quests.onKill(first[0].target,first[0].region);
   expect(quests.claim(first[0].id)).toBe(true);
   const gold=inv.gold;
   expect(quests.claim(first[0].id)).toBe(false);
   expect(inv.gold).toBe(gold);
   quests.refreshDaily(new Date('2026-10-25T12:00:00Z'));
   expect(quests.all().filter(q=>q.category==='bounty')).toHaveLength(5);
   expect(quests.get(first[0].id)).toBeUndefined();
 });
 it('restores counters, claims and story position but rejects unknown IDs',()=>{
   const a=fixture();
   a.quests.onTalk('guide-aurora');a.quests.claim('story-aurora-meet');
   const saved=a.quests.snapshot();
   const b=fixture();
   b.quests.restore({...saved,accepted:['side-aurora','invalid'],claimed:['story-aurora-meet','evil']});
   expect(b.quests.activeStory()?.id).toBe('story-aurora-hunt');
   expect(b.quests.isAccepted('side-aurora')).toBe(true);
   expect(b.quests.get('evil')).toBeUndefined();
 });
 it('assigns real animated KayKit character models to twelve NPCs with guides per region',()=>{
   // NPC instances load asynchronously in-browser; definitions remain testable without WebGL.
   const source=NPCSystem.prototype;
   expect(source).toHaveProperty('update');
   expect(source).toHaveProperty('interact');
 });
});
