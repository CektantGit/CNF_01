export class ViewerState{
  constructor(){
    this.slots=[];
    this.steps=[];
    this.currentStepIndex=0;
  }

  async loadConfig(data, fetchDetails){
    this.slots=[];
    this.steps = Object.entries(data.steps || {}).map(([id, s])=>({id, name:s.name, index:s.index||0}));
    if(!this.steps.length){
      const def={id:crypto.randomUUID(), name:'Step 1', index:0};
      this.steps=[def];
    }
    this.steps.sort((a,b)=>a.index-b.index);
    for(const [id, slotData] of Object.entries(data.slots || {})){
      const slot={
        id,
        name: slotData.name,
        canBeEmpty: slotData.canBeEmpty,
        stepId: slotData.step || this.steps[0].id,
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
    this.currentStepIndex=0;
  }

  get currentStep(){
    return this.steps[this.currentStepIndex];
  }
}
