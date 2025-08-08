export function renderSlots(container, state, onSelect){
  container.innerHTML='';
  state.slots.forEach((slot, sIdx)=>{
    const det=document.createElement('details');
    const sum=document.createElement('summary');
    sum.textContent=slot.name;
    det.appendChild(sum);
    const list=document.createElement('div');
    list.className='object-list';
    const createItem=(obj,oIdx)=>{
      const item=document.createElement('div');
      item.className='object-item';
      if(slot.selectedIndex===oIdx) item.classList.add('selected');
      if(obj){
        const img=document.createElement('img');
        const prev=obj.materials[0]?.previews?.[0];
        img.src=prev?.subRes?.small||prev?.url||'';
        img.alt=obj.name;
        item.appendChild(img);
        const label=document.createElement('div');
        label.className='label';
        label.textContent=obj.name;
        item.appendChild(label);
      }else{
        const none=document.createElement('div');
        none.className='none-thumb';
        none.textContent='✕';
        item.appendChild(none);
        const label=document.createElement('div');
        label.className='label';
        label.textContent='None';
        item.appendChild(label);
      }
      item.addEventListener('click',()=>onSelect(sIdx,oIdx));
      return item;
    };
    if(slot.canBeEmpty){
      list.appendChild(createItem(null,-1));
    }
    slot.objects.forEach((obj,oIdx)=>{
      list.appendChild(createItem(obj,oIdx));
    });
    det.appendChild(list);
    container.appendChild(det);
  });
}
