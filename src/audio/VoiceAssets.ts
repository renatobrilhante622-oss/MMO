import type {SpokenLine} from '../rpg/LoreSystem';
import {npcVoice,NARRATOR} from './VoiceProfiles';
export interface VoiceAsset {key:string;text:string;speaker:string;language:'pt'|'en';}
/** FNV-1a over UTF-16 is shared by the offline generator and browser; no manifest download. */
export function voiceKey(text:string,speaker:string,language:string):string {
  let hash=2166136261;
  const value=language+'|'+speaker+'|'+text;
  for(let i=0;i<value.length;i++)hash=Math.imul(hash^value.charCodeAt(i),16777619);
  return (hash>>>0).toString(16).padStart(8,'0');
}
export function voiceAssets(line:SpokenLine):VoiceAsset[] {
  // Infinite contracts reuse intelligible recorded sentence fragments and numbers 1–100.
  // Campaign and lore chapters are uninterrupted recordings of the complete displayed line.
  const pieces=line.id.startsWith('dynamic-')
    ? (line.text.match(/[^.!?]+[.!?]?/gu)??[line.text]).flatMap(s=>s.split(/(\d+)/u)).map(s=>s.trim()).filter(Boolean)
    : [line.text];
  return pieces.map(text=>{
    const identity=line.speaker==='narrator'?NARRATOR:npcVoice(line.speaker);
    const speaker=/^\d+$/.test(text)?'count-'+identity.profile.gender:line.speaker;
    return {key:voiceKey(text,speaker,line.language),text,speaker,language:line.language};
  });
}
export function voiceAssetUrl(key:string):string {return `/audio/voices/${key}.mp3`;}
