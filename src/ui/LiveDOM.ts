/** Keep focused/pressed controls alive while 10Hz snapshots refresh health and timers. */
export function patchLiveDOM(host:HTMLElement,html:string):void {
 const template=document.createElement('template');template.innerHTML=html;
 const patch=(current:Node,next:Node):void=>{
  if(current.nodeType===Node.TEXT_NODE){if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;return;}
  if(current instanceof Element&&next instanceof Element){
   for(const attribute of [...current.attributes])if(!next.hasAttribute(attribute.name))current.removeAttribute(attribute.name);
   for(const attribute of [...next.attributes])if(current.getAttribute(attribute.name)!==attribute.value)current.setAttribute(attribute.name,attribute.value);
  }
  const desired=[...next.childNodes];for(let i=0;i<desired.length;i++){
   const child=current.childNodes[i],target=desired[i];
   if(!child)current.appendChild(target.cloneNode(true));
   else if(child.nodeName!==target.nodeName)current.replaceChild(target.cloneNode(true),child);
   else patch(child,target);
  }
  while(current.childNodes.length>desired.length)current.removeChild(current.lastChild!);
 };
 patch(host,template.content);
}
