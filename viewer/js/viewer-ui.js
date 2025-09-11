export function renderVariants(container, state, onSelect){
  container.innerHTML='';
  if(state.variants.length<=1){
    container.style.display='none';
    return;
  }
  container.style.display='grid';
  state.variants.forEach((v,idx)=>{
    const btn=document.createElement('button');
    btn.className='variant-btn';
    btn.textContent=v.name;
    if(state.currentVariantIndex===idx) btn.classList.add('selected');
    btn.addEventListener('click',()=>onSelect(idx));
    container.appendChild(btn);
  });
}

export function renderSlots(container, state, onSelect){
  container.innerHTML='';
  const stepId = state.currentStep?.id;
  state.slots.filter(s=>String(s.stepId)===String(stepId)).forEach((slot)=>{
    const sIdx = state.slots.indexOf(slot);
    const det=document.createElement('details');
    det.open = slot.open;
    det.addEventListener('toggle',()=>{slot.open = det.open;});
    const sum=document.createElement('summary');
    sum.textContent=slot.name;
    det.appendChild(sum);
    const list=document.createElement('div');
    list.className='object-list ' + (slot.textButtons ? 'text-mode' : 'thumb-mode');
    if(slot.canBeEmpty){
      if(slot.textButtons){
        const btn=document.createElement('button');
        btn.className='variant-btn text-option';
        btn.textContent='None';
        const len=btn.textContent.length;
        btn.style.fontSize = len>12? '10px' : len>8? '12px' : '14px';
        if(slot.selectedIndex===-1) btn.classList.add('selected');
        btn.addEventListener('click',()=>onSelect(sIdx,-1,0));
        list.appendChild(btn);
      }else{
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
    }
    slot.objects.forEach((obj,oIdx)=>{
      if(!slot.textButtons){
        const objLabel=document.createElement('div');
        objLabel.className='object-label';
        objLabel.textContent=obj.name;
        list.appendChild(objLabel);
      }
      obj.materials.forEach((mat,mIdx)=>{
        if(slot.textButtons){
          const btn=document.createElement('button');
          btn.className='variant-btn text-option';
          if(slot.selectedIndex===oIdx && obj.selectedMaterial===mIdx) btn.classList.add('selected');
          btn.textContent = obj.variationNames?.[mIdx] || mat.name;
          const len=btn.textContent.length;
          btn.style.fontSize = len>12? '10px' : len>8? '12px' : '14px';
          const slotIndex = state.slots.indexOf(slot);
          btn.addEventListener('click',()=>onSelect(slotIndex,oIdx,mIdx));
          list.appendChild(btn);
        }else{
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
          const slotIndex = state.slots.indexOf(slot);
          item.addEventListener('click',()=>onSelect(slotIndex,oIdx,mIdx));
          list.appendChild(item);
        }
      });
    });
    det.appendChild(list);
    container.appendChild(det);
  });
}
