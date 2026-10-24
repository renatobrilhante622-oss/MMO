import type {AdventureProgress} from '../progression/AdventureProgress';
import {benefitIcon} from './GameIllustrations';
import {itemIcon} from './ItemIconRenderer';

/** VIP is a convenience subscription purchased with the local PvE wallet. */
export function renderVip(progress:AdventureProgress,pt=true,now=Date.now()):string {
  const t=(a:string,b:string)=>pt?a:b;
  const active=progress.vipUntil>now;
  const days=Math.max(0,Math.ceil((progress.vipUntil-now)/86400000));
  const benefits=[
    {kind:'farm' as const,title:t('Caçada automática','Automatic hunting'),detail:t('Ataque, habilidades, coleta e poções. Seus limites de HP e mana estão nas Configurações.','Attacks, skills, loot and potions. Set HP and mana thresholds in Settings.')},
    {kind:'teleport' as const,title:t('2 portais pessoais','2 personal portals'),detail:t('Desbloqueia os slots 9 e 10 no mapa enquanto o VIP estiver ativo. Seus destinos são preservados.','Unlocks map slots 9 and 10 while VIP is active. Saved destinations are preserved.')},
    {kind:'diamonds' as const,title:t('100 diamantes VIP','100 VIP diamonds'),detail:t('Recebidos ao ativar. Troque por aparências na Coleção.','Granted on activation. Redeem appearances in Collection.')},
  ];
  return `<div class="vip-palace"><section class="vip-hero ${active?'vip-active':''}"><div class="vip-hero-art" aria-hidden="true">${itemIcon('helmet','legendary')}
    <span class="vip-orbit"></span><span class="vip-orbit second"></span></div>
    <div class="vip-hero-copy"><span class="rpg-eyebrow">ETERNA PRIVILEGE</span><h2>${t('Pacto da Aurora','Pact of Dawn')}</h2>
      <span class="vip-state">${active?'● '+t('VIP ATIVO','VIP ACTIVE'):'◇ '+t('CONVENIÊNCIA PARA SUA JORNADA','CONVENIENCE FOR YOUR JOURNEY')}</span>
      <p>${active?t(`${days} dias restantes · Seus benefícios estão liberados.`,`${days} days remaining · Your benefits are unlocked.`):t('30 dias de benefícios adquiridos com ouro do jogo.','30 days of benefits purchased with in-game gold.')}</p>
      <button class="vip-activate" data-do="vip" ${active||progress.inventory.gold<25000?'disabled':''}>${active?'✓ '+t('Pacto ativo','Pact active'):t('Ativar por 25.000 ouro','Activate for 25,000 gold')}</button>
      <small>${t('Moeda do jogo · Sem cobrança real · PvP com atributos normalizados','In-game currency · No real payment · PvP uses normalized stats')}</small>
    </div></section>
    <div class="vip-benefit-gallery">${benefits.map(b=>`<article class="vip-benefit-plate">${benefitIcon(b.kind)}<div><h3>${b.title}</h3><p>${b.detail}</p><span class="vip-benefit-state ${active?'enabled':''}">${active?'✓ '+t('Disponível','Available'):'◇ '+t('Ative o VIP','Activate VIP')}</span></div></article>`).join('')}</div>
    <footer class="vip-footer"><span>✦ ${progress.vipDiamonds} ${t('diamantes disponíveis','diamonds available')}</span><button data-hub="collection">${t('Explorar a Coleção','Explore Collection')} →</button><button data-hub="pass">${t('Abrir Passe de Batalha','Open Battle Pass')} →</button></footer></div>`;
}
