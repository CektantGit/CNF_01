export function renderSlots(state, container, { onSelect, onDelete }) {
  container.innerHTML = '';
  state.slots.forEach((slot, index) => {
    const li = document.createElement('li');
    li.className = 'slot' + (index === state.currentSlotIndex ? ' selected' : '');
    li.addEventListener('click', () => {
      if (state.currentSlotIndex === index) {
        const newName = prompt('Rename slot', slot.name);
        if (newName) {
          slot.name = newName;
          renderSlots(state, container, { onSelect, onDelete });
        }
      } else {
        onSelect(index);
      }
    });
    const nameSpan = document.createElement('span');
    nameSpan.textContent = slot.name;
    const delBtn = document.createElement('button');
    delBtn.textContent = 'X';
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      onDelete(slot.id);
    });
    li.appendChild(nameSpan);
    li.appendChild(delBtn);
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
      matList.appendChild(btn);
    });
    card.appendChild(title);
    card.appendChild(delBtn);
    card.appendChild(matList);
    container.appendChild(card);
  });
}
