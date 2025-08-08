import { fetchObjects } from './api.js';

let lastPage = 1;

export function openObjectModal(modalEl, { onSelect }) {
  const listEl = modalEl.querySelector('#modalList');
  const pageInfo = modalEl.querySelector('#pageInfo');
  const prevBtn = modalEl.querySelector('#prevPage');
  const nextBtn = modalEl.querySelector('#nextPage');
  const closeBtn = modalEl.querySelector('#closeModal');
  let currentPage = lastPage;
  let totalPages = 1;

  async function load(page) {
    const data = await fetchObjects(page);
    listEl.innerHTML = '';
    data.objs.forEach(obj => {
      const item = document.createElement('div');
      item.className = 'object-item';
      const thumb = document.createElement('div');
      thumb.className = 'thumb';
      const img = document.createElement('img');
      img.src = obj.preview?.subRes?.small || obj.preview?.url || '';
      thumb.appendChild(img);
      const span = document.createElement('span');
      span.textContent = obj.name;
      item.appendChild(thumb);
      item.appendChild(span);
      item.addEventListener('click', () => {
        onSelect(obj);
        close();
      });
      listEl.appendChild(item);
    });
    currentPage = page;
    lastPage = currentPage;
    totalPages = data.pages_count || 1;
    pageInfo.textContent = `${currentPage}/${totalPages}`;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
  }

  function close() {
    modalEl.style.display = 'none';
    prevBtn.removeEventListener('click', prev);
    nextBtn.removeEventListener('click', next);
    closeBtn.removeEventListener('click', close);
  }

  function prev() {
    if (currentPage > 1) load(currentPage - 1);
  }
  function next() {
    if (currentPage < totalPages) load(currentPage + 1);
  }

  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);
  closeBtn.addEventListener('click', close);

  modalEl.style.display = 'block';
  load(currentPage);
}
