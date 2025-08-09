export function renderSlots(container, state, onSelect){
  container.innerHTML='';
  state.slots.forEach((slot, sIdx)=>{
    const det=document.createElement('details');
    det.open = slot.open;
    det.addEventListener('toggle',()=>{slot.open = det.open;});
    const sum=document.createElement('summary');
    sum.textContent=slot.name;
    det.appendChild(sum);
    const list=document.createElement('div');
    list.className='object-list';
    if(slot.canBeEmpty){
      const none=document.createElement('div');
      none.className='object-item';
      if(slot.selectedIndex===-1) none.classList.add('selected');
      const noneThumb=document.createElement('div');
      noneThumb.className='none-thumb';
      noneThumb.textContent='✕';
      none.appendChild(noneThumb);
      const label=document.createElement('div');
      label.className='label';
      label.textContent='None';
      none.appendChild(label);
      none.addEventListener('click',()=>onSelect(sIdx,-1,0));
      list.appendChild(none);
    }
    slot.objects.forEach((obj,oIdx)=>{
      const objLabel=document.createElement('div');
      objLabel.className='object-label';
      objLabel.textContent=obj.name;
      list.appendChild(objLabel);
      obj.materials.forEach((mat,mIdx)=>{
        const item=document.createElement('div');
        item.className='object-item';
        if(slot.selectedIndex===oIdx && obj.selectedMaterial===mIdx) item.classList.add('selected');
        const img=document.createElement('img');
        const prev=mat.previews?.[0];
        img.src=prev?.subRes?.small||prev?.url||'';
        img.alt=mat.name;
        item.appendChild(img);
        const label=document.createElement('div');
        label.className='label';
        label.textContent=mat.name;
        item.appendChild(label);
        item.addEventListener('click',()=>onSelect(sIdx,oIdx,mIdx));
        list.appendChild(item);
      });
    });
    det.appendChild(list);
    container.appendChild(det);
  });
}
