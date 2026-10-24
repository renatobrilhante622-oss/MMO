import { describe, expect, it } from 'vitest';
import { Mesh, MeshStandardMaterial } from 'three';
import { CLASS_DEFINITIONS, CLASS_IDS } from '../src/combat/ClassSystem';
import { ArticulatedCharacter } from '../src/player/ArticulatedCharacter';
import { CreatureRig } from '../src/enemies/CreatureRig';
import type { HeroState } from '../src/core/GameTypes';

const states: HeroState[] = ['idle', 'run', 'jump', 'doubleJump', 'fall', 'climb', 'swim', 'dive', 'slide', 'mounted', 'dead'];

function expectFiniteTransforms(rig: ArticulatedCharacter): void {
  rig.root.updateMatrixWorld(true);
  rig.root.traverse(object => {
    expect(object.matrixWorld.elements.every(Number.isFinite)).toBe(true);
    if (object instanceof Mesh) {
      const positions = object.geometry.attributes.position;
      expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
    }
  });
}

describe('articulated procedural character rigs', () => {
  for (const id of CLASS_IDS) {
    it(`constructs ${id} weapon grips, animates every state and remains finite`, () => {
      const rig = new ArticulatedCharacter(CLASS_DEFINITIONS[id]);
      expect(rig.rightArm.lower.parent).toBe(rig.rightArm.upper);
      expect(rig.rightArm.end.parent).toBe(rig.rightArm.lower);
      expect(rig.leftLeg.lower.parent).toBe(rig.leftLeg.upper);
      expect(rig.weapons.right.parent).toBe(rig.rightArm.end);
      expect(rig.weapons.left.parent).toBe(rig.leftArm.end);
      let elapsed = 0;
      for (const state of states) {
        for (let frame = 0; frame < 12; frame++) {
          elapsed += 1 / 60;
          rig.update(1 / 60, elapsed, state, 1, elapsed * .2, .1);
        }
        expectFiniteTransforms(rig);
      }
      for (let skill = 0; skill < 4; skill++) {
        rig.attack(skill, 3);
        for (let frame = 0; frame < 70; frame++) {
          elapsed += 1 / 60;
          rig.update(1 / 60, elapsed, 'idle', 0, 0, 0);
        }
        expectFiniteTransforms(rig);
      }
      rig.dispose();
      expect(rig.root.children).toHaveLength(0);
    });
  }

  it('uses horizontal swimming pose and distinct bent knees while climbing', () => {
    const rig = new ArticulatedCharacter(CLASS_DEFINITIONS.ranger);
    for (let frame = 0; frame < 60; frame++) rig.update(1 / 60, frame / 60, 'swim', 1, 0, 0);
    expect(rig.root.rotation.x).toBeGreaterThan(1.3);
    for (let frame = 0; frame < 60; frame++) rig.update(1 / 60, frame / 60, 'climb', 1, 0, 0);
    expect(rig.leftArm.upper.rotation.x).toBeLessThan(-1.9);
    expect(rig.leftLeg.lower.rotation.x).toBeGreaterThan(.5);
    rig.dispose();
  });

  it('replaces weapon assemblies without retaining disposed class geometry', () => {
    const rig = new ArticulatedCharacter(CLASS_DEFINITIONS.berserker);
    const old = rig.weapons;
    rig.setClass(CLASS_DEFINITIONS.warlock);
    expect(old.right.parent).toBeNull();
    expect(old.left.children).toHaveLength(0);
    expect(rig.weapons.left.parent).toBe(rig.leftArm.end);
    expect(rig.weapons.left.children.length).toBeGreaterThan(0);
    rig.dispose();
  });

  it('builds and animates all enemy silhouettes with articulated limbs', () => {
    for (const kind of ['slime', 'wolf', 'skeleton', 'golem', 'wraith', 'boss']) {
      const material = new MeshStandardMaterial();
      const rig = new CreatureRig(kind, kind === 'boss', material);
      for (let frame = 0; frame < 120; frame++) rig.update(1 / 60, frame / 60, 3, frame > 60, .4, .1);
      rig.root.updateMatrixWorld(true);
      rig.root.traverse(object => object.matrixWorld.elements.forEach(value => expect(Number.isFinite(value)).toBe(true)));
      expect(rig.root.children.length).toBeGreaterThan(0);
      rig.dispose();
      material.dispose();
    }
  });
});
