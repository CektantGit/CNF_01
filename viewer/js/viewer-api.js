const API_STAGE_BASE = 'https://api-stage.vizbl.us';

export async function fetchObjectDetails(uuid){
  try{
    const res = await fetch('https://api.vizbl.us/obj/Fetch',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({uuid})
    });
    if(!res.ok) return null;
    return await res.json();
  }catch(e){
    console.error('fetchObjectDetails',e);
    return null;
  }
}

export async function fetchConfiguration(uuid){
  try{
    const res = await fetch(`${API_STAGE_BASE}/obj/FetchConfiguration`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({uuid})
    });
    if(!res.ok) return null;
    return await res.json();
  }catch(e){
    console.error('fetchConfiguration',e);
    return null;
  }
}
