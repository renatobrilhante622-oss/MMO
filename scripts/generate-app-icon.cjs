/* Regenerates committed launcher artwork only. Requires sharp; never invokes an Android build. */
const fs=require('node:fs/promises');
const path=require('node:path');
const sharp=require('sharp');
const root=path.resolve(__dirname,'..');
const marks=Array.from({length:48},(_,i)=>{const a=i*2.399963,r=350+(i%7)*22,x=512+Math.cos(a)*r,y=525+Math.sin(a)*r;return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${2+i%4}" fill="${i%3?'#82dc8f':'#daf2b4'}" opacity="${.2+(i%5)*.1}"/>`;}).join('');
const folds=Array.from({length:34},(_,i)=>{const t=i/33,x=154+t*205;return `<path d="M${x.toFixed(1)} 890Q${(225+t*80).toFixed(1)} ${(610-t*50).toFixed(1)} ${(300+t*145).toFixed(1)} ${(250-t*90).toFixed(1)}" stroke="${i%3?'#4b635a':'#8c9e7b'}" stroke-opacity="${.09+(i%4)*.02}" stroke-width="${1+i%3}" fill="none"/><path d="M${(1024-x).toFixed(1)} 890Q${(799-t*80).toFixed(1)} ${(610-t*50).toFixed(1)} ${(724-t*145).toFixed(1)} ${(250-t*90).toFixed(1)}" stroke="#7a8a70" stroke-opacity=".12" stroke-width="2" fill="none"/>`;}).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs>
 <radialGradient id="night"><stop stop-color="#223b31"/><stop offset=".55" stop-color="#0b1d1b"/><stop offset="1" stop-color="#020908"/></radialGradient>
 <linearGradient id="hood" x1=".12" x2=".8" y2="1"><stop stop-color="#6d7f66"/><stop offset=".27" stop-color="#273d35"/><stop offset=".56" stop-color="#122723"/><stop offset=".78" stop-color="#3a4b3b"/><stop offset="1" stop-color="#081616"/></linearGradient>
 <linearGradient id="fold" x1="0" x2="1"><stop stop-color="#87987a"/><stop offset=".45" stop-color="#243d31"/><stop offset="1" stop-color="#081515"/></linearGradient>
 <radialGradient id="face" cy=".3"><stop stop-color="#243f32"/><stop offset=".5" stop-color="#14251f"/><stop offset="1" stop-color="#050d0d"/></radialGradient>
 <linearGradient id="eye" x2="0" y2="1"><stop stop-color="#f1ffd6"/><stop offset=".4" stop-color="#a9ff77"/><stop offset="1" stop-color="#20be5a"/></linearGradient>
 <filter id="glow" x="-.8" y="-.8" width="2.6" height="2.6"><feGaussianBlur stdDeviation="10"/></filter>
 <filter id="smoke" x="-.5" y="-.5" width="2" height="2"><feGaussianBlur stdDeviation="5"/></filter>
 <filter id="fineGlow" x="-.5" y="-.5" width="2" height="2"><feGaussianBlur stdDeviation="3"/></filter>
 <clipPath id="round"><rect x="20" y="20" width="984" height="984" rx="195"/></clipPath>
</defs>
<g clip-path="url(#round)">
<rect width="1024" height="1024" fill="url(#night)"/>
<circle cx="512" cy="499" r="407" fill="none" stroke="#4f765448" stroke-width="2"/><circle cx="512" cy="499" r="374" fill="none" stroke="#b6b5881a" stroke-width="1"/>
<path d="M76 808Q191 737 131 558T155 227M916 823Q797 737 888 523T861 172" fill="none" stroke="#61c984" stroke-width="17" opacity=".2" filter="url(#glow)"/>
<path d="M76 808Q191 737 131 558T155 227M916 823Q797 737 888 523T861 172" fill="none" stroke="#72d99c" stroke-width="3" opacity=".5"/>
${marks}
<path d="M67 1024 127 832 212 727 256 364Q289 146 490 67L518 59Q742 141 788 359l55 371 75 112 39 182Z" fill="url(#hood)" stroke="#809077" stroke-opacity=".5" stroke-width="5"/>
<path d="M512 122Q347 197 303 366L238 792 352 924 512 994 678 920 791 791 721 362Q679 194 512 122Z" fill="#081512" stroke="#adb98b" stroke-opacity=".4" stroke-width="8"/>
<path d="M512 175Q351 265 337 420L302 762 401 881 512 915 626 881 728 760 685 411Q668 264 512 175Z" fill="url(#face)"/>
<path d="M318 598Q309 345 486 166L454 117Q283 250 261 477L207 836 298 950 365 874 286 768Z" fill="url(#fold)"/>
<path d="M706 598Q715 345 538 166L570 117Q741 250 763 477L817 836 726 950 659 874 738 768Z" fill="url(#fold)"/>
${folds}
<path d="m366 402 125 59-11 34-122-36-21-31m321-28-125 61 10 34 122-38 22-30" fill="#314738" stroke="#799078" stroke-opacity=".32" stroke-width="4"/>
<path d="m351 471 129 46-20 44-78-23-33-31m324-38-130 48 20 44 80-24 32-32" fill="#73f07c" opacity=".8" filter="url(#glow)"/>
<path d="M357 480Q415 491 478 519L459 543Q405 542 366 512Zm310 0Q609 491 546 519l19 24q54-1 93-31Z" fill="url(#eye)"/>
<path d="m375 490 83 27m191-27-83 27" stroke="#edffd8" stroke-width="6" stroke-linecap="round"/>
<path d="m489 476-23 162 45 29 49-31-26-160" fill="#1b2d23"/><path d="m487 607-8 32 31 17 31-17-8-31" fill="#060e0d" stroke="#648063" stroke-opacity=".36" stroke-width="3"/>
<path d="m368 562 54 78-31 75 121 104 123-105-32-74 52-82-72 49-28 91-43 30-44-30-30-91Z" fill="#2b3f2e" stroke="#5e7757" stroke-opacity=".38" stroke-width="3"/>
<path d="m414 717 98 31 100-31-29 46-72 38-68-39Z" fill="#050c0c"/><path d="m436 731 16 8-5 28-12-11m33-16 16 5-3 34-13-9m32-26h17l-3 44-13-9m30-38 17-6-3 39-13 9m31-49 15-9-5 31-12 11" fill="#a1b991"/>
<path d="m397 608 18 34m-17 23 21 28m205-85-18 34m17 24-20 28" stroke="#789269" stroke-opacity=".4" stroke-width="4"/>
<path d="m459 273 51-45 53 47-22 61-30 30-31-31Z" fill="#2e4837" stroke="#a8b486" stroke-opacity=".6" stroke-width="3"/><path d="m488 283 25-24 22 25-22 42Z" fill="#9adc89" opacity=".42"/><path d="m511 260 0 64m-21-39 21 14 20-14" stroke="#d1e9af" stroke-width="3"/>
<path d="m120 1024 161-169 68 51 162 64 169-65 67-50 154 169" fill="#111f1c" stroke="#8f9872" stroke-opacity=".4" stroke-width="4"/>
<path d="M250 903q80 48 130 45m393-46q-80 48-130 45" stroke="#c5bf87" stroke-opacity=".45" stroke-width="4" fill="none"/>
<path d="m176 562 42 10-20 42m636-38-43 15 22 34M241 210l20 13-12 23m507-33-22 14 13 22" fill="none" stroke="#b9d68b" stroke-opacity=".6" stroke-width="4"/>
<path d="M126 713q-31-63 16-119m755 129q35-77-16-132" fill="none" stroke="#9aeaa9" stroke-width="5" filter="url(#fineGlow)" opacity=".55"/>
<rect x="27" y="27" width="970" height="970" rx="188" fill="none" stroke="#c1c38a" stroke-opacity=".26" stroke-width="3"/>
</g></svg>`;
async function main(){
 const assets=path.join(root,'public/assets');await fs.mkdir(assets,{recursive:true});await fs.writeFile(path.join(assets,'icon.svg'),svg);await fs.writeFile(path.join(root,'public/favicon.svg'),svg);
 const image=await sharp(Buffer.from(svg)).png().toBuffer();await fs.writeFile(path.join(assets,'icon.png'),image);
 for(const [density,scale]of Object.entries({mdpi:1,hdpi:1.5,xhdpi:2,xxhdpi:3,xxxhdpi:4})){
  const dir=path.join(root,'android/app/src/main/res/mipmap-'+density);await fs.mkdir(dir,{recursive:true});const size=Math.round(48*scale);
  await sharp(image).resize(size,size).png().toFile(path.join(dir,'ic_launcher.png'));
  const mask=Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/></svg>`);
  await sharp(image).resize(size,size).composite([{input:mask,blend:'dest-in'}]).png().toFile(path.join(dir,'ic_launcher_round.png'));
  const fore=Math.round(108*scale),content=Math.round(fore*.75),resized=await sharp(image).resize(content,content).png().toBuffer();
  await sharp({create:{width:fore,height:fore,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:resized,left:Math.round((fore-content)/2),top:Math.round((fore-content)/2)}]).png().toFile(path.join(dir,'ic_launcher_foreground.png'));
 }
 const res=path.join(root,'android/app/src/main/res');
 await fs.writeFile(path.join(res,'values/ic_launcher_background.xml'),'<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">#081512</color></resources>\n');
 const bitmap='<?xml version="1.0" encoding="utf-8"?>\n<bitmap xmlns:android="http://schemas.android.com/apk/res/android" android:src="@mipmap/ic_launcher_foreground" android:gravity="center" android:filter="true" />\n';
 await fs.writeFile(path.join(res,'drawable/ic_eterna.xml'),bitmap);await fs.writeFile(path.join(res,'drawable-v24/ic_launcher_foreground.xml'),bitmap);
 const manifest=path.join(root,'android/app/src/main/AndroidManifest.xml');let xml=await fs.readFile(manifest,'utf8');xml=xml.replace('android:icon="@drawable/ic_eterna"','android:icon="@mipmap/ic_launcher"').replace('android:roundIcon="@drawable/ic_eterna"','android:roundIcon="@mipmap/ic_launcher_round"');await fs.writeFile(manifest,xml);
 console.log('Generated 1024px icon, SVG favicon and launcher/round/adaptive foreground for five Android densities.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
