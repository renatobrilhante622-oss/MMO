import {expect} from 'vitest';
import {QUEST_STORY,type QuestDefinition,type QuestSystem} from '../../src/rpg/QuestSystem';
/** Unit-level event signals; browser encounter tests exercise their physical sources separately. */
export function satisfyObjective(quests:QuestSystem,q:QuestDefinition):void {
 if(q.goal==='talk')quests.onTalk(q.target);
 else if(q.goal==='kill')for(let i=0;i<q.required;i++)quests.onKill(q.target,q.region);
 else if(q.goal==='collect')quests.onCollect(q.region,q.required);
 else if(q.goal==='boss')quests.onKill('boss',q.region,true);
 else for(let i=0;i<q.required;i++)quests.onActivity(q.goal,q.region,q.goal==='investigate'?q.target:`${q.region}-${q.goal}-${i}`);
}
export function finishChapter(quests:QuestSystem,region:string,claimBoss=true):void {
 for(const q of QUEST_STORY.filter(q=>q.region===region)){satisfyObjective(quests,q);if(q.goal!=='boss'||claimBoss)expect(quests.claim(q.id),q.id).toBe(true);}
}
