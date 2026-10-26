/** A transition owns input blocking in Engine; this layer only displays real load state. */
export class MapLoadingScreen {
 readonly root=document.createElement('section');private readonly title=document.createElement('strong');
 constructor(host:HTMLElement){this.root.className='map-loading-screen';this.root.hidden=true;this.root.setAttribute('role','status');this.root.setAttribute('aria-live','polite');const mark=document.createElement('span');mark.textContent='✦';const caption=document.createElement('small');caption.textContent='ETERNA · TRAVESSIA ANCESTRAL';this.root.append(mark,caption,this.title);host.append(this.root);}
 show(name:string):void{this.title.textContent=name;this.root.hidden=false;}
 hide():void{this.root.hidden=true;}
 dispose():void{this.root.remove();}
}
