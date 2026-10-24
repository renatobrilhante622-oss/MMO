export const HUD_KEYS=['joystick','combat','movement','minimap','vitals','shortcuts','autofarm'] as const;
export type HudKey=typeof HUD_KEYS[number];
export interface HudPlacement {x:number;y:number;scale:number;opacity:number;}
export type HudLayout=Partial<Record<HudKey,HudPlacement>>;
export const HUD_STORAGE_KEY='eterna-hud-layout-v2';
const finite=(v:unknown,fallback:number)=>typeof v==='number'&&Number.isFinite(v)?v:fallback;
export function readHudLayout(value:unknown):HudLayout {
  const result:HudLayout={};if(!value||typeof value!=='object')return result;
  const raw=value as Record<string,unknown>;
  for(const key of HUD_KEYS){const p=raw[key];if(!p||typeof p!=='object')continue;const v=p as Record<string,unknown>;result[key]={x:Math.max(0,Math.min(1,finite(v.x,0))),y:Math.max(0,Math.min(1,finite(v.y,0))),scale:Math.max(.5,Math.min(1.5,finite(v.scale,1))),opacity:Math.max(.2,Math.min(1,finite(v.opacity,1)))};}
  return result;
}
export function keepHudOnscreen(p:HudPlacement,width:number,height:number,viewportWidth:number,viewportHeight:number):HudPlacement {
  const maxX=Math.max(0,1-width*p.scale/Math.max(1,viewportWidth)),maxY=Math.max(0,1-height*p.scale/Math.max(1,viewportHeight));
  return {...p,x:Math.max(0,Math.min(maxX,p.x)),y:Math.max(0,Math.min(maxY,p.y))};
}
