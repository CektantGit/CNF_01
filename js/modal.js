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
      const card = document.createElement('div');
      card.className = 'modal-card';

      const thumb = document.createElement('div');
      thumb.className = 'thumb';
      const img = document.createElement('img');
      img.src = obj.preview?.subRes?.small || obj.preview?.url || '';
      thumb.appendChild(img);
      const overlay = document.createElement('div');
      overlay.className = 'overlay';
      const title = document.createElement('p');
      title.textContent = obj.name;
      thumb.appendChild(overlay);
      thumb.appendChild(title);
      card.appendChild(thumb);

      const info = document.createElement('div');
      info.className = 'info';

      const owner = document.createElement('div');
      owner.className = 'owner';
      const avatar = document.createElement('span');
      avatar.className = 'avatar';
      avatar.textContent = obj.owner?.name ? obj.owner.name[0] : '';
      owner.appendChild(avatar);
      const ownerName = document.createElement('p');
      ownerName.textContent = obj.owner?.name || '';
      owner.appendChild(ownerName);
      info.appendChild(owner);

      const counts = document.createElement('div');
      counts.className = 'counts';
      const viewsWrap = document.createElement('div');
      viewsWrap.className = 'count';
      viewsWrap.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21.8701 11.496C21.2301 10.386 17.7101 4.81597 11.7301 4.99597C6.20007 5.13597 3.00007 9.99597 2.13007 11.496C2.0423 11.648 1.99609 11.8204 1.99609 11.996C1.99609 12.1715 2.0423 12.3439 2.13007 12.496C2.76007 13.586 6.13007 18.996 12.0201 18.996H12.2701C17.8001 18.856 21.0101 13.996 21.8701 12.496C21.9577 12.3439 22.0039 12.1715 22.0039 11.996C22.0039 11.8204 21.9577 11.648 21.8701 11.496ZM12.0001 15.496C11.5355 15.5038 11.0741 15.4191 10.6426 15.2468C10.2112 15.0744 9.81833 14.8179 9.48704 14.4922C9.15575 14.1664 8.89263 13.778 8.71302 13.3495C8.53341 12.921 8.44091 12.4611 8.44091 11.9965C8.44091 11.5319 8.53341 11.0719 8.71302 10.6434C8.89263 10.2149 9.15575 9.8265 9.48704 9.50076C9.81833 9.17503 10.2112 8.91851 10.6426 8.74617C11.0741 8.57383 11.5355 8.48911 12.0001 8.49697C12.9283 8.49697 13.8186 8.86571 14.4749 9.52209C15.1313 10.1785 15.5001 11.0687 15.5001 11.997C15.5001 12.9252 15.1313 13.8155 14.4749 14.4718C13.8186 15.1282 12.9283 15.496 12.0001 15.496Z" fill="currentColor"></path></svg>`;
      const viewsCount = document.createElement('p');
      viewsCount.textContent = obj.viewsShowcase ?? obj.views ?? 0;
      viewsWrap.appendChild(viewsCount);
      counts.appendChild(viewsWrap);

      const likesWrap = document.createElement('div');
      likesWrap.className = 'count';
      likesWrap.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M16.6011 3.12072C17.2514 3.15332 17.8923 3.29981 18.4951 3.55427C19.1836 3.84496 19.8093 4.27105 20.3362 4.80801L20.529 5.01393C20.9663 5.50534 21.3179 6.07062 21.5676 6.68471C21.853 7.38644 22 8.13895 22 8.89853C22 9.65809 21.853 10.4106 21.5676 11.1123C21.3559 11.633 21.0701 12.1178 20.7217 12.5529L20.6953 12.6902L20.5861 12.7892L20.0693 13.2592L19.411 13.9317L12.617 20.8529C12.2973 21.1786 11.7917 21.1995 11.4487 20.9146L11.3822 20.8529L3.6629 12.9882C2.59837 11.9035 2.00003 10.4325 2 8.89853C2.00006 7.36455 2.59828 5.8927 3.6629 4.80801C4.72748 3.72355 6.17147 3.11471 7.67689 3.11464C9.18247 3.11464 10.6271 3.72339 11.6917 4.80801L11.9996 5.12167L12.3074 4.80801C12.8345 4.27085 13.4607 3.84502 14.1494 3.55427C14.8382 3.2635 15.5767 3.11377 16.3223 3.11377L16.6011 3.12072Z" fill="currentColor"></path></svg>`;
      const likesCount = document.createElement('p');
      likesCount.textContent = obj.likes ?? 0;
      likesWrap.appendChild(likesCount);
      counts.appendChild(likesWrap);

      info.appendChild(counts);
      card.appendChild(info);

      card.addEventListener('click', () => {
        onSelect(obj);
        close();
      });

      listEl.appendChild(card);
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
