export function renderSlots(state, container, { onSelect, onDelete, onToggleHide }, stepId) {
  container.innerHTML = '';
  const vp = document.createElement('li');
  vp.className = 'slot' + (state.currentSlotIndex === -1 ? ' selected' : '');
  vp.addEventListener('click', () => onSelect('view'));
  const nameSpan = document.createElement('span');
  nameSpan.textContent = 'Point view';
  const hideBtn = document.createElement('button');
  hideBtn.textContent = 'Hide';
  hideBtn.className = 'hide-btn' + (state.viewPoint.hidden ? ' active' : '');
  hideBtn.addEventListener('click', e => { e.stopPropagation(); onToggleHide('view'); });
  const actions = document.createElement('div');
  actions.className = 'slot-actions';
  actions.appendChild(hideBtn);
  vp.appendChild(nameSpan);
  vp.appendChild(actions);
  container.appendChild(vp);
  state.slots.filter(s=>s.stepId===stepId).forEach((slot) => {
    const index = state.slots.indexOf(slot);
    const li = document.createElement('li');
    li.className = 'slot' + (index === state.currentSlotIndex ? ' selected' : '');
    li.addEventListener('click', () => {
      if (state.currentSlotIndex === index) {
        const newName = prompt('Rename slot', slot.name);
        if (newName) {
          slot.name = newName;
          renderSlots(state, container, { onSelect, onDelete, onToggleHide }, stepId);
        }
        } else {
          onSelect(index);
        }
      });
    const nameSpan = document.createElement('span');
    nameSpan.textContent = slot.name;
    const hideBtn = document.createElement('button');
    hideBtn.textContent = 'Hide';
    hideBtn.className = 'hide-btn' + (slot.hidden ? ' active' : '');
    hideBtn.addEventListener('click', e => {
      e.stopPropagation();
      onToggleHide(slot);
    });
    const delBtn = document.createElement('button');
    delBtn.textContent = 'X';
    delBtn.className = 'action-btn';
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      onDelete(slot.id);
    });
    const actions = document.createElement('div');
    actions.className = 'slot-actions';
    actions.appendChild(hideBtn);
    actions.appendChild(delBtn);
    li.appendChild(nameSpan);
    li.appendChild(actions);
    container.appendChild(li);
  });
}

export function renderObjects(slot, container, { onSelectObject, onSelectMaterial, onDelete }) {
  container.innerHTML = '';
  if (!slot) return;
  slot.objects.forEach((obj, objIndex) => {
    const card = document.createElement('div');
    card.className = 'obj-card' + (objIndex === slot.selectedObjectIndex ? ' selected' : '');
    const title = document.createElement('div');
    title.textContent = obj.name;
    title.addEventListener('click', () => onSelectObject(objIndex));
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.className = 'action-btn';
    delBtn.addEventListener('click', () => onDelete(objIndex));
    const matList = document.createElement('div');
    matList.className = 'material-list';
    obj.materials.forEach((mat, matIndex) => {
      const btn = document.createElement('button');
      const img = document.createElement('img');
      const url = mat.previews?.[0]?.subRes?.small || mat.previews?.[0]?.url;
      img.src = url || '';
      img.alt = mat.name;
      btn.appendChild(img);
      btn.addEventListener('click', e => {
        e.stopPropagation();
        onSelectMaterial(objIndex, matIndex);
      });
      if (objIndex === slot.selectedObjectIndex && matIndex === obj.selectedMaterial) {
        btn.classList.add('selected');
        const check=document.createElement('span');
        check.className='check';
        const chkImg=document.createElement('img');
        chkImg.src='https://cdn.jsdelivr.net/npm/lucide-static@0.452.0/icons/check.svg';
        check.appendChild(chkImg);
        btn.appendChild(check);
      }
      matList.appendChild(btn);
    });
    card.appendChild(title);
    card.appendChild(delBtn);
    card.appendChild(matList);
    container.appendChild(card);
  });
}

export function renderSlotsMobile(state, container, slotCallbacks, objectCallbacks, stepId){
  container.innerHTML='';
  const vp=document.createElement('details');
  vp.className='slot-mobile';
  const sum=document.createElement('summary');
  sum.textContent='Point view';
  sum.addEventListener('click',e=>{slotCallbacks.onSelect('view');});
  const actions=document.createElement('span');
  actions.className='slot-actions';
  const hide=document.createElement('button');
  hide.textContent='Hide';
  hide.className='hide-btn'+(state.viewPoint.hidden?' active':'');
  hide.addEventListener('click',e=>{e.stopPropagation();slotCallbacks.onToggleHide('view');});
  actions.appendChild(hide);
  sum.appendChild(actions);
  vp.appendChild(sum);
  container.appendChild(vp);
  state.slots.filter(s=>s.stepId===stepId).forEach((slot)=>{
    const index = state.slots.indexOf(slot);
    const det=document.createElement('details');
    det.className='slot-mobile';
    det.open = slot._mobileOpen || false;
    det.addEventListener('toggle',()=>{slot._mobileOpen = det.open;});
    const sum=document.createElement('summary');
    sum.textContent=slot.name;
    sum.addEventListener('click',e=>{
      if(state.currentSlotIndex===index){
        if(e.detail===2){
          const newName=prompt('Rename slot',slot.name);
          if(newName){slot.name=newName;renderSlotsMobile(state,container,slotCallbacks,objectCallbacks,stepId);} }
      }else{
        slotCallbacks.onSelect(index);
      }
    });
    const actions=document.createElement('span');
    actions.className='slot-actions';
    const hide=document.createElement('button');
    hide.textContent='Hide';
    hide.className='hide-btn'+(slot.hidden?' active':'');
    hide.addEventListener('click',e=>{e.stopPropagation();slotCallbacks.onToggleHide(slot);renderSlotsMobile(state,container,slotCallbacks,objectCallbacks,stepId);});
    const del=document.createElement('button');
    del.textContent='X';
    del.className='action-btn';
    del.addEventListener('click',e=>{e.stopPropagation();slotCallbacks.onDelete(slot.id);renderSlotsMobile(state,container,slotCallbacks,objectCallbacks,stepId);});
    actions.appendChild(hide);actions.appendChild(del);sum.appendChild(actions);
    det.appendChild(sum);
    const body=document.createElement('div');
    slot.objects.forEach((obj,objIndex)=>{
      const card=document.createElement('div');
      card.className='obj-card'+(objIndex===slot.selectedObjectIndex?' selected':'');
      const title=document.createElement('div');
      title.textContent=obj.name;
      title.addEventListener('click',()=>{state.currentSlotIndex=index;objectCallbacks.onSelectObject(objIndex);});
      const delBtn=document.createElement('button');
      delBtn.textContent='Delete';
      delBtn.className='action-btn';
      delBtn.addEventListener('click',()=>{state.currentSlotIndex=index;objectCallbacks.onDelete(objIndex);renderSlotsMobile(state,container,slotCallbacks,objectCallbacks,stepId);});
      const matList=document.createElement('div');
      matList.className='material-list';
      obj.materials.forEach((mat,matIndex)=>{
        const btn=document.createElement('button');
        const img=document.createElement('img');
        const url=mat.previews?.[0]?.subRes?.small||mat.previews?.[0]?.url;
        img.src=url||'';img.alt=mat.name;btn.appendChild(img);
        btn.addEventListener('click',e=>{e.stopPropagation();state.currentSlotIndex=index;objectCallbacks.onSelectMaterial(objIndex,matIndex);renderSlotsMobile(state,container,slotCallbacks,objectCallbacks,stepId);});
        if(objIndex===slot.selectedObjectIndex && matIndex===obj.selectedMaterial){btn.classList.add('selected');}
        matList.appendChild(btn);
      });
      card.appendChild(title);card.appendChild(delBtn);card.appendChild(matList);body.appendChild(card);
    });
    det.appendChild(body);
    container.appendChild(det);
  });
}
