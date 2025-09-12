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
