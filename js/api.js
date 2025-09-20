const API_STAGE_BASE = 'https://api-stage.vizbl.us';

export async function fetchObjects(page = 1) {
  try {
    const res = await fetch(`https://api.vizbl.us/obj/GetPublic?page=${page}`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
  } catch (err) {
    console.error('API error', err);
    return { objs: [], pages_count: 0 };
  }
}

export async function fetchObjectDetails(uuid) {
  try {
    const res = await fetch('https://api.vizbl.us/obj/Fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid })
    });
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
  } catch (err) {
    console.error('API error', err);
    return null;
  }
}

export async function fetchConfiguration(uuid) {
  try {
    const res = await fetch(`${API_STAGE_BASE}/obj/FetchConfiguration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid })
    });
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
  } catch (err) {
    console.error('API error', err);
    return null;
  }
}

export async function uploadConfiguration(payload, token) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_STAGE_BASE}/obj/UpdateConfiguration`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || 'Network response was not ok');
    }
    return await res.json();
  } catch (err) {
    console.error('API error', err);
    throw err;
  }
}
