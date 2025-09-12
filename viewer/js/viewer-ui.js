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
  state.slots
    .filter(s=>String(s.stepId)===String(stepId))
    .filter(s=>s.canBeEmpty || s.objects.length>1)
    .forEach((slot)=>{
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
        btn.setAttribute('aria-pressed', slot.selectedIndex===-1);
        btn.addEventListener('click',()=>onSelect(slotIndex,-1,0));
        list.appendChild(btn);
        fitButtonText(btn);
      }else{
        const none=document.createElement('button');
        none.className='object-item';
        none.type='button';
        if(slot.selectedIndex===-1) none.classList.add('selected');
        none.setAttribute('aria-pressed', slot.selectedIndex===-1);
        const thumb=document.createElement('div');
        thumb.className='thumb';
        const img=document.createElement('img');
        img.src='https://cdn.jsdelivr.net/npm/lucide-static@0.452.0/icons/x.svg';
        img.alt='None';
        thumb.appendChild(img);
        if(slot.selectedIndex===-1){
          const check=document.createElement('span');
          check.className='check';
          const chkImg=document.createElement('img');
          chkImg.src='https://cdn.jsdelivr.net/npm/lucide-static@0.452.0/icons/check.svg';
          check.appendChild(chkImg);
          thumb.appendChild(check);
        }
        none.appendChild(thumb);
        const label=document.createElement('div');
        label.className='label muted';
        label.textContent='None';
        none.appendChild(label);
        none.addEventListener('click',()=>onSelect(slotIndex,-1,0));
        list.appendChild(none);
      }
    }
    slot.objects.forEach((obj,oIdx)=>{
      obj.materials.forEach((mat,mIdx)=>{
        if(slot.textButtons){
          const btn=document.createElement('button');
          btn.className='variant-btn text-option';
          const selected = slot.selectedIndex===oIdx && obj.selectedMaterial===mIdx;
          if(selected) btn.classList.add('selected');
          btn.setAttribute('aria-pressed', selected);
          btn.textContent = obj.colorNames?.[mIdx] || mat.name;
          btn.addEventListener('click',()=>onSelect(slotIndex,oIdx,mIdx));
          list.appendChild(btn);
          fitButtonText(btn);
        }else{
          const item=document.createElement('button');
          item.className='object-item';
          item.type='button';
          const selected = slot.selectedIndex===oIdx && obj.selectedMaterial===mIdx;
          if(selected) item.classList.add('selected');
          item.setAttribute('aria-pressed', selected);
          const thumb=document.createElement('div');
          thumb.className='thumb';
          const prev=mat.previews?.[0];
          const img=document.createElement('img');
          img.src=prev?.subRes?.small||prev?.url||'';
          img.alt=mat.name;
          thumb.appendChild(img);
          if(selected){
            const check=document.createElement('span');
            check.className='check';
            const chkImg=document.createElement('img');
            chkImg.src='https://cdn.jsdelivr.net/npm/lucide-static@0.452.0/icons/check.svg';
            check.appendChild(chkImg);
            thumb.appendChild(check);
          }
          item.appendChild(thumb);
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
