import {renderClanVisualHub} from './ClanVisualHub';

/** Legacy local preview; live screens should pass server state to renderClanVisualHub. */
export function clanFortress(bossFraction: number, level: number): string {
  return renderClanVisualHub({connected: true, bossHp: bossFraction * 50000, bossMaxHp: 50000,
    bossAttackAt: 0, serverTime: 0, level, memberCount: 1});
}
