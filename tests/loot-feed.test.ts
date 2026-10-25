import {describe,expect,it} from 'vitest';
import {Vector3} from 'three';
import type {LootDrop} from '../src/core/GameTypes';
import {describeLoot} from '../src/ui/LootToastFeed';

const reward=(overrides:Partial<LootDrop>={}):LootDrop=>({
  id:'loot-1',position:new Vector3(),xp:40,gold:50,crystals:1,...overrides
});

describe('compact reward HUD',()=>{
  it('displays only rewards granted by the real loot event',()=>{
    expect(describeLoot(reward())).toEqual({
      title:'Recompensa coletada',detail:'+40 XP · +50 Ouro · +1 Cristais',
      icon:'chest',rarity:'common'
    });
  });
  it('uses item rarity and equipment artwork for a real drop',()=>{
    const item={id:'item-1',name:'Lâmina Mítica',slot:'weapon',rarity:'mythic',
      level:20,upgrade:0,attack:50,defense:5,maxHp:0,value:100};
    const e=describeLoot(reward({gold:0,crystals:0,xp:125,item:item as LootDrop['item']}));
    expect(e).toEqual({title:'Lâmina Mítica',detail:'+125 XP',icon:'weapon',rarity:'mythic'});
  });
  it('ignores empty rewards and malformed values',()=>{
    expect(describeLoot(reward({gold:0,crystals:0,xp:0}))).toBeNull();
    expect(describeLoot(reward({gold:NaN,crystals:-1,xp:Infinity}))).toBeNull();
  });
});
