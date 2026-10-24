import {describe, expect, it} from 'vitest';
import {renderClanVisualHub, type ClanVisualState} from '../src/ui/ClanVisualHub';

const state = (overrides: Partial<ClanVisualState> = {}): ClanVisualState => ({connected:true,bossHp:37500,bossAttackAt:0,serverTime:100000,level:4,memberCount:8,...overrides});
describe('live clan fortress navigation', () => {
  it('shows actual member count, raid buff and weekly boss health with aligned semantic modules', () => {
    const html = renderClanVisualHub(state());
    expect(html).toContain('8 companheiros de armas');
    expect(html).toContain('+9% dano de raid');
    expect(html).toContain('75% de vida do guardião');
    expect(html).toContain('aria-valuenow="37500"');
    for (const id of ['members','altar','buffs']) expect(html).toContain(`data-do="fortress-focus" data-id="${id}"`);
    expect(html.match(/data-status="active"/g)).toHaveLength(4);
    expect(html).toContain('feTurbulence');
    expect(html).toContain('patternUnits="userSpaceOnUse"');
  });
  it('distinguishes cooldown, defeated boss and disconnected/missing-clan states', () => {
    const cooldown = renderClanVisualHub(state({bossAttackAt:122100}));
    expect(cooldown).toContain('Recarga 23s');
    expect(cooldown).toContain('data-status="cooldown"');
    expect(renderClanVisualHub(state({bossHp:0}))).toContain('data-status="defeated"');
    const offline = renderClanVisualHub(state({connected:false}));
    expect(offline.match(/data-status="locked"/g)).toHaveLength(4);
    expect(offline).toContain('Conecte ao servidor');
    expect(offline).not.toContain('Ataque disponível');
    expect(renderClanVisualHub(state({memberCount:0}))).toContain('Entre em um clã');
  });
  it('uses unique SVG texture ids, clamps malformed numbers and renders English labels', () => {
    const a = renderClanVisualHub(state());
    const b = renderClanVisualHub(state({bossHp:Infinity,level:NaN,memberCount:-20}),false);
    expect(a.match(/id="(clan-scene-\d+)-sky"/)?.[1]).not.toBe(b.match(/id="(clan-scene-\d+)-sky"/)?.[1]);
    expect(b).toContain('Members Hall');
    expect(b).toContain('Join a clan');
    expect(b).not.toContain('NaN');
    expect(b).not.toContain('Infinity');
  });
});
