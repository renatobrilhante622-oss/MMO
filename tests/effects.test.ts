import { describe, expect, it, vi } from 'vitest';
import { Mesh, Points, Scene, Vector3 } from 'three';
import { ParticleSystem3D } from '../src/combat/ParticleSystem3D';
import { CLASS_DEFINITIONS, CLASS_IDS } from '../src/combat/ClassSystem';
import { CombatSystem } from '../src/combat/CombatSystem';
import { EventBus, type Combatant } from '../src/core/GameTypes';
import { SoundEngine } from '../src/core/SoundEngine';

describe('combat visual effects resource lifecycle', () => {
  it('renders every skill profile with finite spawn data and retires transient meshes', () => {
    const scene = new Scene();
    const effects = new ParticleSystem3D(scene);
    for (const classId of CLASS_IDS) {
      CLASS_DEFINITIONS[classId].skills.forEach((skill, index) => {
        effects.cast(new Vector3(3, 2, 1), new Vector3(0, 0, -1), skill, index);
      });
    }
    effects.update(0.016);
    const cloud = effects.root.children.find(object => object instanceof Points) as Points;
    expect(cloud).toBeDefined();
    for (const key of ['position', 'velocity', 'particleColor', 'timing', 'behavior']) {
      const data = cloud.geometry.getAttribute(key);
      for (const value of data.array) expect(Number.isFinite(value)).toBe(true);
    }
    expect(effects.diagnostics.rings).toBeLessThanOrEqual(32);
    expect(effects.diagnostics.trails).toBeLessThanOrEqual(12);
    for (let i = 0; i < 200; i++) effects.update(0.016);
    expect(effects.root.children.filter(object => object instanceof Mesh)).toHaveLength(0);
    effects.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('keeps a fixed GPU allocation under burst load and supports repeated cleanup', () => {
    const scene = new Scene();
    const effects = new ParticleSystem3D(scene);
    const cloud = effects.root.children[0] as Points;
    const original = cloud.geometry.getAttribute('position').array;
    for (let i = 0; i < 180; i++) effects.celebration(new Vector3(i, 0, 0), i % 2 === 0);
    expect(cloud.geometry.getAttribute('position').array).toBe(original);
    expect(cloud.geometry.getAttribute('position').count).toBe(4096);
    expect(effects.diagnostics.rings).toBeLessThanOrEqual(32);
    effects.dispose();
    effects.dispose();
    effects.burst(new Vector3(), 0xff0000);
    expect(scene.children).toHaveLength(0);
  });

  it('animates only accepted attacks and casts, preserving cooldown and mana rules', () => {
    const scene = new Scene();
    const combat = new CombatSystem(scene, new EventBus());
    const visualAttack = vi.fn();
    const source: Combatant & { mana: number; consumeMana: (cost: number) => boolean; heal: () => void; visualAttack: typeof visualAttack } = {
      id: 'visual-test', position: new Vector3(), radius: 0.5, hp: 100, maxHp: 100,
      defense: 0, alive: true, team: 'hero', invulnerable: false, receiveDamage: () => 0,
      mana: 100, consumeMana(cost) { if (this.mana < cost) return false; this.mana -= cost; return true; },
      heal: () => undefined, visualAttack,
    };
    const stats = CLASS_DEFINITIONS.berserker.stats;
    expect(combat.attack(source, [], stats, new Vector3(0, 0, 1))).toBe(true);
    expect(combat.attack(source, [], stats, new Vector3(0, 0, 1))).toBe(false);
    expect(visualAttack).toHaveBeenCalledTimes(1);
    expect(combat.cast(0, 'berserker', source, [], stats, new Vector3(0, 0, 1))).toBe(true);
    expect(combat.cast(0, 'berserker', source, [], stats, new Vector3(0, 0, 1))).toBe(false);
    expect(visualAttack).toHaveBeenCalledTimes(2);
    source.mana = 0;
    expect(combat.cast(1, 'berserker', source, [], stats, new Vector3(0, 0, 1))).toBe(false);
    expect(visualAttack).toHaveBeenCalledTimes(2);
    combat.dispose();
    expect(scene.children).toHaveLength(0);
  });
});

describe('audio outside a browser', () => {
  it('does not construct an AudioContext before a gesture and degrades safely without WebAudio', async () => {
    const audio = new SoundEngine();
    audio.attack('berserker', 3);
    audio.spell('elementalist', 3);
    audio.impact(true);
    audio.coin();
    audio.levelUp();
    audio.bossRoar();
    await audio.unlock();
    audio.setEnabled(false);
    audio.update(0.05, { daylight: 0.5, moving: true, inWater: true, boss: true });
    expect(audio.diagnostics).toEqual({ unlocked: false, voices: 0, enabled: false });
    audio.dispose();
    audio.dispose();
  });
});
