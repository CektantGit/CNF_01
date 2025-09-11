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
