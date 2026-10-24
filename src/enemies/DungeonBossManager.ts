import { DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, Scene, Vector3 } from 'three';
import type { Combatant } from '../core/GameTypes';
import { EventBus } from '../core/GameTypes';
import { DUNGEONS, type DungeonDefinition } from '../world/Regions';
import { calculateDamage } from '../combat/ClassSystem';
import { Enemy, EnemyAI } from './EnemyAI';

interface Telegraph { group: Group; center: Vector3; radius: number; remaining: number; duration: number; damage: number; ring: Mesh; fill: Mesh; fillPositions: Float32Array }

export class DungeonBossManager {
  definition: DungeonDefinition = DUNGEONS[0];
  clears = 0;
  active = false;
  wave = 0;
  completed = false;
  status = 'Portal da masmorra · aproxime-se e interaja';
  private waveEnemies: Enemy[] = [];
  private waveDelay = 0;
  private boss: Enemy | null = null;
  private bossPhase = 0;
  private bossTimer = 0;
  private telegraphs: Telegraph[] = [];
  private arenaRing: Mesh;
  private elapsed = 0;

  constructor(private scene: Scene, private enemies: EnemyAI, private events: EventBus, private portalPosition: Vector3) {
    this.arenaRing = new Mesh(new RingGeometry(20.7, 21, 96), new MeshBasicMaterial({ color: 0xba7efa, transparent: true, opacity: .35, depthWrite: false, side: DoubleSide }));
    this.arenaRing.rotation.x = -Math.PI / 2;
    this.arenaRing.position.copy(portalPosition); this.arenaRing.position.y += .15;
    this.arenaRing.visible = false; scene.add(this.arenaRing);
  }

  start(hero: Combatant, definition: DungeonDefinition = this.definition, playerLevel = 1): boolean {
    if (playerLevel < definition.level) { this.events.emit('message', {text: `Nível ${definition.level} necessário / Level required`, tone: 'warning'}); return false; }
    this.definition = definition;
    if (this.active || !hero.alive) return false;
    if (hero.position.distanceTo(this.portalPosition) > 13) { this.events.emit('message', { text: 'Aproxime-se do portal violeta para entrar na masmorra.', tone: 'info' }); return false; }
    this.active = true; this.completed = false; this.wave = 0; this.boss = null; this.bossPhase = 0; this.waveDelay = .75;
    this.waveEnemies.length = 0; this.arenaRing.visible = true;
    this.status = 'Desafio da masmorra · preparando a primeira onda';
    this.events.emit('message', { text: `${this.definition.name[0]} · ${this.definition.waves} ondas / waves`, tone: 'success' });
    return true;
  }

  update(dt: number, hero: Combatant): void {
    this.elapsed += dt;
    this.updateTelegraphs(dt, hero);
    if (!this.active) return;
    if (!hero.alive || hero.position.distanceTo(this.portalPosition) > 65) {
      this.active = false; this.arenaRing.visible = false; this.status = 'Desafio interrompido · retorne ao portal para tentar novamente';
      this.clearTelegraphs();
      this.waveEnemies.forEach(enemy => { if (enemy.alive) { enemy.hp = 0; enemy.deathTime = 0; } });
      this.events.emit('message', { text: 'O desafio terminou. Seu progresso de personagem foi preservado.', tone: 'warning' });
      return;
    }
    (this.arenaRing.material as MeshBasicMaterial).opacity = .3 + Math.sin(this.elapsed * 2) * .1;
    const living = this.waveEnemies.filter(enemy => enemy.alive);
    if (living.length === 0) {
      if (this.wave === this.definition.waves + 1) { this.finish(); return; }
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) this.spawnWave(hero);
      else this.status = `Onda ${this.wave} concluída · próxima em ${Math.ceil(this.waveDelay)}s`;
    } else if (this.boss?.alive) {
      const ratio = this.boss.hp / this.boss.maxHp;
      const phase = ratio > .65 ? 1 : ratio > .3 ? 2 : 3;
      if (phase !== this.bossPhase) {
        this.bossPhase = phase;
        this.events.emit('message', { text: `Guardião · Fase ${phase}${phase === 3 ? ' — Fúria do vazio!' : ''}`, tone: 'warning' });
        this.bossTimer = 1.4;
      }
      this.status = `Guardião do Vazio · Fase ${phase} · ${Math.ceil(this.boss.hp)} / ${this.boss.maxHp} HP`;
      this.bossTimer -= dt;
      if (this.bossTimer <= 0) {
        this.bossTimer = phase === 1 ? 4.2 : phase === 2 ? 3.2 : 2.3;
        this.telegraph(hero.position.clone(), phase === 3 ? 4 : 3, phase === 3 ? 1.05 : 1.5, (28 + phase * 10) * (1 + this.definition.level * .035));
        if (phase >= 2) {
          this.telegraph(this.boss.position.clone(), 6 + phase, 1.9, (30 + phase * 10) * (1 + this.definition.level * .035));
          const offset = new Vector3(Math.sin(this.elapsed) * 6, 0, Math.cos(this.elapsed) * 6);
          this.telegraph(hero.position.clone().add(offset), 3.5, 2.2, 34 * (1 + this.definition.level * .035));
        }
      }
    } else this.status = `Onda ${this.wave} / ${this.definition.waves} · ${living.length} inimigos restantes`;
  }

  private spawnWave(hero: Combatant): void {
    this.wave++; this.waveEnemies.length = 0; this.waveDelay = 3;
    if (this.wave === this.definition.waves + 1) {
      const position = this.portalPosition.clone().add(new Vector3(0, 3, -8));
      this.boss = this.enemies.spawn('boss', position, this.definition.level + 2, true);
      this.waveEnemies.push(this.boss); this.bossTimer = 2;
      this.events.emit('message', { text: 'O Guardião do Vazio despertou. Saia das áreas vermelhas!', tone: 'warning' });
      return;
    }
    const kinds = this.wave === 1 ? ['slime', 'wolf'] : this.wave === 2 ? ['skeleton', 'wolf', 'wraith'] : ['golem', 'wraith', 'skeleton'];
    const count = Math.min(12, 3 + this.wave * 2);
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count + this.wave;
      const point = this.portalPosition.clone().add(new Vector3(Math.cos(angle) * 13, 2, Math.sin(angle) * 13));
      if (point.distanceTo(hero.position) < 4) point.add(new Vector3(4, 0, -3));
      this.waveEnemies.push(this.enemies.spawn(kinds[i % kinds.length], point, this.definition.level + this.wave - 1));
    }
    this.events.emit('message', { text: `Onda ${this.wave} · ${count} criaturas atravessaram o portal.`, tone: 'info' });
  }

  private telegraph(position: Vector3, radius: number, duration: number, damage: number): void {
    const group = new Group();
    const center = position.clone();
    center.y = this.enemies.terrainHeight(center.x, center.z) + .16;
    const ring = new Mesh(new RingGeometry(radius * .96, radius, 64, 2), new MeshBasicMaterial({ color: 0xff4b54, transparent: true, opacity: .9, depthWrite: false, side: DoubleSide }));
    const fill = new Mesh(new RingGeometry(0, radius, 64, 12), new MeshBasicMaterial({ color: 0xff263f, transparent: true, opacity: .12, depthWrite: false, side: DoubleSide }));
    const fillPositions = new Float32Array(fill.geometry.attributes.position.array);
    this.conformTelegraph(ring, center);
    this.conformTelegraph(fill, center, .05, fillPositions);
    ring.rotation.x = -Math.PI / 2; fill.rotation.x = -Math.PI / 2;
    group.add(ring, fill); group.position.copy(center); this.scene.add(group);
    this.telegraphs.push({ group, center, radius, remaining: duration, duration, damage, ring, fill, fillPositions });
  }

  private conformTelegraph(mesh: Mesh, center: Vector3, scale = 1, original?: Float32Array): void {
    const positions = mesh.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = (original ? original[i * 3] : positions.getX(i)) * scale;
      const y = (original ? original[i * 3 + 1] : positions.getY(i)) * scale;
      // The mesh is rotated -PI/2 around X: its local Y is world -Z, local Z is world Y.
      positions.setXYZ(i, x, y, this.enemies.terrainHeight(center.x + x, center.z - y) + .16 - center.y);
    }
    positions.needsUpdate = true;
    mesh.geometry.computeBoundingSphere();
  }

  private updateTelegraphs(dt: number, hero: Combatant): void {
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const zone = this.telegraphs[i]; zone.remaining -= dt;
      const progress = 1 - Math.max(0, zone.remaining / zone.duration);
      this.conformTelegraph(zone.fill, zone.center, Math.max(.05, progress), zone.fillPositions);
      (zone.fill.material as MeshBasicMaterial).opacity = .13 + progress * .3;
      if (zone.remaining <= 0) {
        if (hero.alive && Math.hypot(hero.position.x - zone.center.x, hero.position.z - zone.center.z) <= zone.radius + hero.radius && hero.position.y - zone.center.y < 4) {
          const direction = hero.position.clone().sub(zone.center).setY(1).normalize().multiplyScalar(9);
          const dealt = hero.receiveDamage(calculateDamage(zone.damage, hero.defense), direction);
          if (dealt > 0) this.events.emit('damage', { position: hero.position.clone().add(new Vector3(0, 1.4, 0)), amount: dealt, critical: false, team: 'hero', color: 0xff6070 });
        }
        this.disposeTelegraph(zone); this.telegraphs.splice(i, 1);
      }
    }
  }

  private finish(): void {
    this.clears++; this.active = false; this.completed = true; this.arenaRing.visible = false; this.clearTelegraphs();
    this.status = 'Masmorra concluída · o Guardião foi derrotado';
    this.events.emit('message', { text: 'Vitória! O Guardião caiu. Recolha seu tesouro e retorne à vila.', tone: 'success' });
  }
  private disposeTelegraph(zone: Telegraph): void { this.scene.remove(zone.group); zone.group.traverse(child => { if (child instanceof Mesh) { child.geometry.dispose(); (child.material as MeshBasicMaterial).dispose(); } }); }
  private clearTelegraphs(): void { this.telegraphs.forEach(zone => this.disposeTelegraph(zone)); this.telegraphs.length = 0; }
  dispose(): void { this.clearTelegraphs(); this.scene.remove(this.arenaRing); this.arenaRing.geometry.dispose(); (this.arenaRing.material as MeshBasicMaterial).dispose(); }
}
