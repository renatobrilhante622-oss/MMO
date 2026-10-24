import type {AdventureProgress} from '../progression/AdventureProgress';

/** Explicit PvE gold sinks; summons never silently spend a different currency. */
export const MERCHANT_OFFERS = {
  crystals: {gold:600, quantity:10, cap:999999999},
  tickets: {gold:1200, quantity:1, cap:99999},
} as const;

export function purchaseMerchant(progress:AdventureProgress,product:keyof typeof MERCHANT_OFFERS):boolean {
  const offer=MERCHANT_OFFERS[product];
  if(!offer)return false;
  const current=product==='crystals'?progress.inventory.crystals:progress.tickets;
  const gold=progress.inventory.gold;
  if(!Number.isFinite(gold)||!Number.isSafeInteger(current)||current<0||gold<offer.gold||current+offer.quantity>offer.cap)return false;
  // Validate every value before committing either side of the exchange.
  progress.inventory.gold=gold-offer.gold;
  if(product==='crystals')progress.inventory.crystals=current+offer.quantity;
  else progress.tickets=current+offer.quantity;
  return true;
}
