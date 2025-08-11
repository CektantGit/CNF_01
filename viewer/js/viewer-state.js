export class ViewerState{
  constructor(){
    this.slots=[];
    this.steps=[];
    this.currentStepIndex=0;
  }

  async loadConfig(data, fetchDetails){
    this.slots=[];
    // allow steps to be provided either as an object map or an array
    if(Array.isArray(data.steps)){
      this.steps = data.steps.map((s,i)=>({
        id: s.id || crypto.randomUUID(),
        name: s.name || `Step ${i+1}`,
        index: s.index ?? i
      }));
    }else{
      this.steps = Object.entries(data.steps || {}).map(([id,s],i)=>({
        id,
        name: s.name || `Step ${i+1}`,
        index: s.index ?? i
      }));
    }
    if(!this.steps.length){
      const def={id:crypto.randomUUID(),name:'Step 1',index:0};
      this.steps=[def];
    }
    this.steps.sort((a,b)=>a.index-b.index);
    this.currentStepIndex=0;
    const defaultStepId = this.steps[0].id;
    for(const [id, slotData] of Object.entries(data.slots || {})){
      const slot={
        id,
        name: slotData.name,
        canBeEmpty: slotData.canBeEmpty,
        objects: [],
        selectedIndex: slotData.canBeEmpty ? -1 : 0,
        open:false,
        currentMesh:null,
        // accept legacy 'stepId' or numeric step indexes
        stepId: slotData.step || slotData.stepId || defaultStepId
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

  get currentStep(){
    return this.steps[this.currentStepIndex];
  }
}
