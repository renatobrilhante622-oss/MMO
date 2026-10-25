import {describe,expect,it} from 'vitest';
import {Group,Scene,Vector3} from 'three';
import {EventBus,type CharacterStats,type Combatant} from '../src/core/GameTypes';
import {CLASS_DEFINITIONS} from '../src/combat/ClassSystem';
import {CombatSystem} from '../src/combat/CombatSystem';
import {PetAndMountSystem} from '../src/companions/PetAndMountSystem';
import type {HeroController} from '../src/player/HeroController';
import type {PhysicsWorld} from '../src/physics/PhysicsWorld';
import {AutoFarmController,type FarmContext} from '../src/systems/VipAndAutoFarm';
import {emptyInput} from '../src/core/GameTypes';

function target(x:number,z=0):Combatant{
  return {
    id:'training-target',team:'enemy',position:new Vector3(x,0,z),radius:.6,
    hp:1000,maxHp:1000,defense:0,get alive(){return this.hp>0;},
    invulnerable:false,
    receiveDamage(amount:number){const dealt=Math.min(this.hp,Math.max(0,amount));this.hp-=dealt;return dealt;}
  };
}

function heroStats():CharacterStats{
  return {...CLASS_DEFINITIONS.berserker.stats,range:3,attack:65,critChance:0,attackSpeed:1};
}

describe('combat target acquisition',()=>{
  it('auto-aims a melee basic attack at an enemy beside the facing direction and removes real HP',()=>{
    const scene=new Scene(),events=new EventBus(),combat=new CombatSystem(scene,events),enemy=target(2.6);
    let aimed=0,damageEvents=0;
    const source={
      ...target(0),id:'hero',team:'hero' as const,hp:500,maxHp:500,
      position:new Vector3(),aimAt:()=>{aimed++;},
    };
    events.on('damage',({team})=>{if(team==='enemy')damageEvents++;});
    expect(combat.attack(source,[enemy],heroStats(),new Vector3(0,0,-1))).toBe(true);
    expect(enemy.hp).toBeLessThan(1000);
    expect(aimed).toBe(1);
    expect(damageEvents).toBe(1);
    combat.dispose();
  });

  it('locks ranged magic onto a living target even when the character faces away',()=>{
    const combat=new CombatSystem(new Scene(),new EventBus()),enemy=target(8,1);
    const caster={
      ...target(0),id:'hero',team:'hero' as const,position:new Vector3(),
      mana:200,consumeMana(cost:number){if(this.mana<cost)return false;this.mana-=cost;return true;},
      heal(_amount:number){},
      aimAt(_point:Vector3,_lunge:number){}
    };
    expect(combat.cast(0,'elementalist',caster,[enemy],CLASS_DEFINITIONS.elementalist.stats,new Vector3(0,0,-1))).toBe(true);
    for(let frame=0;frame<40&&enemy.hp===1000;frame++)combat.update(.05);
    expect(enemy.hp).toBeLessThan(1000);
    combat.dispose();
  });
});

describe('rider saddle binding',()=>{
  it('attaches character to mount saddle and restores the hero when dismounting',()=>{
    const scene=new Scene(),rig=new Group(),model=new Group();
    model.add(rig);scene.add(model);
    const hero={
      position:new Vector3(0,.5,0),facing:new Vector3(0,0,-1),
      radius:.5,alive:true,mounted:false,model,rig:{root:rig},
      machine:{state:'idle'},stats:{attack:20}
    } as unknown as HeroController;
    const physics={terrainHeight:()=>0,waterLevel:0} as unknown as PhysicsWorld;
    const companions=new PetAndMountSystem(scene,hero,physics,new EventBus());
    companions.toggleMount();
    companions.update(.016,[],[]);
    const saddle=companions.mount.getObjectByName('mountSaddleNode');
    expect(saddle).toBeDefined();
    expect(rig.parent).toBe(saddle);
    expect(rig.position.y).toBeCloseTo(-.75,6);
    companions.toggleMount();
    companions.update(.016,[],[]);
    expect(rig.parent).toBe(model);
    expect(rig.position.y).toBe(0);
    companions.dispose();
  });

  it('keeps the rider original world scale when the mount evolves',()=>{
    const scene=new Scene(),rig=new Group(),model=new Group();
    model.add(rig);scene.add(model);
    const hero={
      position:new Vector3(0,.5,0),facing:new Vector3(0,0,-1),
      radius:.5,alive:true,mounted:false,model,rig:{root:rig},
      machine:{state:'idle'},stats:{attack:20}
    } as unknown as HeroController;
    const physics={terrainHeight:()=>0,waterLevel:0} as unknown as PhysicsWorld;
    const companions=new PetAndMountSystem(scene,hero,physics,new EventBus());
    companions.setEvolution(1,10);
    companions.toggleMount();
    companions.update(.016,[],[]);
    rig.updateWorldMatrix(true,false);
    expect(rig.getWorldScale(new Vector3()).x).toBeCloseTo(1,5);
    companions.dispose();
    expect(rig.parent).toBe(model);
  });
});

describe('VIP farm acquisition',()=>{
  it('acquires a living higher-level normal enemy without selecting a boss',()=>{
    const context:FarmContext={vip:true,enabled:true,alive:true,inDungeon:false,level:10,
      x:0,z:0,hp:100,maxHp:100,mana:100,maxMana:100,
      healthThreshold:.5,manaThreshold:.4,input:emptyInput(),attackRange:3};
    const farm=new AutoFarmController();
    const step=farm.update(context,[
      {id:'boss',alive:true,boss:true,level:10,position:{x:2,z:0}},
      {id:'farmable',alive:true,boss:false,level:18,position:{x:12,z:0}}
    ],[],.016);
    expect(step.target?.id).toBe('farmable');
    expect(step.destination).toEqual({x:12,z:0});
  });
});
