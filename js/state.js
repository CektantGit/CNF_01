export class ConfiguratorState {
  constructor() {
    this.variants = [];
    this.currentVariantIndex = 0;
    this.currentSlotIndex = -1;
    this.currentStepIndex = 0;
    const def = this._createVariant('Variant 1');
    this.variants.push(def);
  }

  get currentVariant() { return this.variants[this.currentVariantIndex]; }
  get steps() { return this.currentVariant.steps; }
  get slots() { return this.currentVariant.slots; }
  get environment() { return this.currentVariant.environment; }

  _createVariant(name) {
    const step = { id: crypto.randomUUID(), name: 'Step 1', index: 0 };
    return { id: crypto.randomUUID(), name, steps: [step], slots: [], environment: null };
  }

  addVariant(name = `Variant ${this.variants.length + 1}`) {
    const v = this._createVariant(name);
    this.variants.push(v);
    this.currentVariantIndex = this.variants.length - 1;
    this.currentSlotIndex = -1;
    this.currentStepIndex = 0;
    return v;
  }

  deleteCurrentVariant() {
    if (this.variants.length <= 1) return;
    this.variants.splice(this.currentVariantIndex, 1);
    if (this.currentVariantIndex >= this.variants.length) this.currentVariantIndex = 0;
    this.currentSlotIndex = -1;
    this.currentStepIndex = 0;
  }

  renameCurrentVariant(name) {
    this.currentVariant.name = name;
  }

  clearVariant() {
    const v = this.currentVariant;
    const def = { id: crypto.randomUUID(), name: 'Step 1', index: 0 };
    v.steps = [def];
    v.slots = [];
    v.environment = null;
    this.currentSlotIndex = -1;
    this.currentStepIndex = 0;
  }

  addSlot(name = 'New slot') {
    const stepId = this.currentStep ? this.currentStep.id : this.steps[0].id;
    const slot = {
      id: crypto.randomUUID(),
      name,
      objects: [],
      selectedObjectIndex: -1,
      canBeEmpty: false,
      hidden: false,
      stepId
    };
    this.slots.push(slot);
    this.currentSlotIndex = this.slots.length - 1;
    return slot;
  }

  addSlotFromData(id, name, objects = [], canBeEmpty = false, stepId = this.steps[0].id) {
    const slot = {
      id,
      name,
      objects,
      selectedObjectIndex: objects.length ? 0 : -1,
      canBeEmpty,
      hidden: false,
      stepId
    };
    this.slots.push(slot);
    if (this.currentSlotIndex === -1) this.currentSlotIndex = 0;
    return slot;
  }

  removeSlot(id) {
    const idx = this.slots.findIndex(s => s.id === id);
    if (idx !== -1) {
      const stepId = this.slots[idx].stepId;
      this.slots.splice(idx, 1);
      const stepSlots = this.slots.filter(s => s.stepId === stepId);
      const target = stepSlots[0] ? this.slots.indexOf(stepSlots[0]) : this.slots[0] ? 0 : -1;
      this.currentSlotIndex = target;
    }
  }

  get currentSlot() { return this.slots[this.currentSlotIndex]; }

  addObjectToCurrent(objectData) {
    if (!this.currentSlot) return null;
    const obj = {
      uuid: objectData.uuid,
      name: objectData.name,
      materials: objectData.materials || [],
      selectedMaterial: 0,
      transform: { position: [0,0,0], rotation:[0,0,0], scale:[1,1,1] }
    };
    this.currentSlot.objects.push(obj);
    this.currentSlot.selectedObjectIndex = this.currentSlot.objects.length - 1;
    return obj;
  }

  inheritFromFirst(slot){
    if(!slot || slot.objects.length<2) return;
    const first = slot.objects[0];
    slot.objects.slice(1).forEach(o=>{
      o.transform.position=[...first.transform.position];
      o.transform.rotation=[...first.transform.rotation];
    });
  }

  addStep(name){
    const step={id:crypto.randomUUID(),name,index:this.steps.length};
    this.steps.push(step);
    return step;
  }

  setEnvironment(obj){
    this.currentVariant.environment = obj;
  }

  removeEnvironment(){ this.currentVariant.environment = null; }

  get currentStep(){ return this.steps[this.currentStepIndex]; }

  async importJSON(data, fetchDetails){
    this.variants=[];
    if(data.variants){
      for(const [vid,vdata] of Object.entries(data.variants)){
        const variant=this._createVariant(vdata.name||'Variant');
        variant.id=vid;
        variant.steps = Object.entries(vdata.steps||{}).map(([id,s])=>({id,name:s.name,index:s.index||0}));
        if(!variant.steps.length) variant.steps=[{id:crypto.randomUUID(),name:'Step 1',index:0}];
        variant.steps.sort((a,b)=>a.index-b.index);
        for(const [sid,slotData] of Object.entries(vdata.slots||{})){
          const objects=[];
          for(const objData of slotData.objects||[]){
            const det=await fetchDetails(objData.uuid); if(!det) continue;
            objects.push({uuid:objData.uuid,name:det.name,materials:det.materials||[],selectedMaterial:0,transform:{position:objData.position||[0,0,0],rotation:objData.rotation||[0,0,0],scale:objData.scale||[1,1,1]}});
          }
          variant.slots.push({id:sid,name:slotData.name,objects,selectedObjectIndex:objects.length?0:-1,canBeEmpty:slotData.canBeEmpty,hidden:false,stepId:slotData.step||variant.steps[0].id});
        }
        if(vdata.environment){
          const det=await fetchDetails(vdata.environment.uuid);
          if(det) variant.environment={uuid:vdata.environment.uuid,name:det.name,materials:det.materials||[],selectedMaterial:0,transform:{position:vdata.environment.position||[0,0,0],rotation:vdata.environment.rotation||[0,0,0],scale:vdata.environment.scale||[1,1,1]}};
        }
        this.variants.push(variant);
      }
    } else {
      const variant=this._createVariant('Variant 1');
      variant.steps = Object.entries(data.steps||{}).map(([id,s])=>({id,name:s.name,index:s.index||0}));
      if(!variant.steps.length) variant.steps=[{id:crypto.randomUUID(),name:'Step 1',index:0}];
      variant.steps.sort((a,b)=>a.index-b.index);
      for(const [id,slotData] of Object.entries(data.slots||{})){
        const objects=[];
        for(const objData of slotData.objects||[]){
          const det=await fetchDetails(objData.uuid); if(!det) continue;
          objects.push({uuid:objData.uuid,name:det.name,materials:det.materials||[],selectedMaterial:0,transform:{position:objData.position||[0,0,0],rotation:objData.rotation||[0,0,0],scale:objData.scale||[1,1,1]}});
        }
        variant.slots.push({id,name:slotData.name,objects,selectedObjectIndex:objects.length?0:-1,canBeEmpty:slotData.canBeEmpty,hidden:false,stepId:slotData.step||variant.steps[0].id});
      }
      if(data.environment){
        const det=await fetchDetails(data.environment.uuid);
        if(det) variant.environment={uuid:data.environment.uuid,name:det.name,materials:det.materials||[],selectedMaterial:0,transform:{position:data.environment.position||[0,0,0],rotation:data.environment.rotation||[0,0,0],scale:data.environment.scale||[1,1,1]}};
      }
      this.variants.push(variant);
    }
    this.currentVariantIndex=0;
    this.currentStepIndex=0;
    const firstIdx=this.slots.findIndex(s=>s.stepId===this.currentStep.id);
    this.currentSlotIndex=firstIdx;
  }

  exportJSON(){
    const variantsOut={};
    this.variants.forEach(variant=>{
      const stepsOut={};
      variant.steps.forEach(step=>{stepsOut[step.id]={name:step.name,index:step.index};});
      const slotsOut={};
      variant.slots.forEach(slot=>{
        slotsOut[slot.id]={name:slot.name,canBeEmpty:slot.canBeEmpty,step:slot.stepId,objects:slot.objects.map(o=>({uuid:o.uuid,position:o.transform.position,rotation:o.transform.rotation,scale:o.transform.scale}))};
      });
      const out={name:variant.name,steps:stepsOut,slots:slotsOut};
      if(variant.environment){ out.environment={uuid:variant.environment.uuid,position:variant.environment.transform.position,rotation:variant.environment.transform.rotation,scale:variant.environment.transform.scale}; }
      variantsOut[variant.id]=out;
    });
    return JSON.stringify({version:2,variants:variantsOut},null,2);
  }
}
