export class ViewerState{
  constructor(){
    this.slots=[];
  }

  async loadConfig(data, fetchDetails){
    this.slots=[];
    for(const [id, slotData] of Object.entries(data.slots || {})){
      const slot={
        id,
        name: slotData.name,
        canBeEmpty: slotData.canBeEmpty,
        objects: [],
        selectedIndex: slotData.canBeEmpty ? -1 : 0,
        open:false,
        currentMesh:null
      };
      for(const obj of slotData.objects || []){
        const details = await fetchDetails(obj.uuid);
        if(!details) continue;
        slot.objects.push({
          uuid: obj.uuid,
          name: details.name,
          materials: details.materials || [],
          selectedMaterial:0,
          transform: {
            position: obj.position || [0,0,0],
            rotation: obj.rotation || [0,0,0],
            scale: obj.scale || [1,1,1]
          },
          mesh: null
        });
      }
      this.slots.push(slot);
    }
  }
}
