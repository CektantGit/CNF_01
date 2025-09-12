function fitButtonText(btn){
  const base=14;
  btn.style.fontSize=base+'px';
  const max=btn.clientWidth*0.85;
  if(!max) return; // skip when button has no layout yet
  const canvas=fitButtonText._c||(fitButtonText._c=document.createElement('canvas'));
  const ctx=canvas.getContext('2d');
  const style=getComputedStyle(btn);
  ctx.font=`${style.fontWeight} ${base}px ${style.fontFamily}`;
  const w=ctx.measureText(btn.textContent).width;
  if(w>max){
    btn.style.fontSize=Math.floor(base*max/w)+'px';
  }
}

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
    fitButtonText(btn);
  });
}

export function renderSlots(container, state, onSelect){
  container.innerHTML='';
  const stepId = state.currentStep?.id;
  state.slots.filter(s=>String(s.stepId)===String(stepId)).forEach((slot)=>{
    const slotIndex = state.slots.indexOf(slot);
    const wrap = document.createElement('div');
    wrap.className='slot-section';
    const title = document.createElement('div');
    title.className='slot-name';
    title.textContent = slot.name;
    wrap.appendChild(title);
    const list = document.createElement('div');
    list.className = 'object-list ' + (slot.textButtons ? 'text-mode' : 'thumb-mode');
    if(slot.canBeEmpty){
      if(slot.textButtons){
        const btn=document.createElement('button');
        btn.className='variant-btn text-option';
        btn.textContent='None';
        if(slot.selectedIndex===-1) btn.classList.add('selected');
        btn.addEventListener('click',()=>onSelect(slotIndex,-1,0));
        list.appendChild(btn);
        fitButtonText(btn);
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
        none.addEventListener('click',()=>onSelect(slotIndex,-1,0));
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
          btn.textContent = obj.colorNames?.[mIdx] || mat.name;
          btn.addEventListener('click',()=>onSelect(slotIndex,oIdx,mIdx));
          list.appendChild(btn);
          fitButtonText(btn);
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
          item.addEventListener('click',()=>onSelect(slotIndex,oIdx,mIdx));
          list.appendChild(item);
        }
      });
    });
    wrap.appendChild(list);
    container.appendChild(wrap);
  });
}
