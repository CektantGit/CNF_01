export class ConfiguratorState {
  constructor() {
    const defaultStep = { id: crypto.randomUUID(), name: 'Step 1', index: 0 };
    this.steps = [defaultStep];
    this.slots = [];
    this.currentSlotIndex = -1;
  }

  clear() {
    const def = { id: crypto.randomUUID(), name: 'Step 1', index: 0 };
    this.steps = [def];
    this.slots = [];
    this.currentSlotIndex = -1;
  }

  addSlot(name = 'New slot') {
    const slot = {
      id: crypto.randomUUID(),
      name,
      objects: [],
      selectedObjectIndex: -1,
      canBeEmpty: false,
       hidden: false,
       stepId: this.steps[0].id
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
    if (this.currentSlotIndex === -1) {
      this.currentSlotIndex = 0;
    }
    return slot;
  }

  removeSlot(id) {
    const idx = this.slots.findIndex(s => s.id === id);
    if (idx !== -1) {
      this.slots.splice(idx, 1);
      if (this.currentSlotIndex >= this.slots.length) {
        this.currentSlotIndex = this.slots.length - 1;
      }
    }
  }

  get currentSlot() {
    return this.slots[this.currentSlotIndex];
  }

  addObjectToCurrent(objectData) {
    if (!this.currentSlot) return null;
    const obj = {
      uuid: objectData.uuid,
      name: objectData.name,
      materials: objectData.materials || [],
      selectedMaterial: 0,
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      }
    };
    this.currentSlot.objects.push(obj);
    this.currentSlot.selectedObjectIndex = this.currentSlot.objects.length - 1;
    return obj;
  }

  inheritFromFirst(slot) {
    if (!slot || slot.objects.length < 2) return;
    const first = slot.objects[0];
    slot.objects.slice(1).forEach(obj => {
      obj.transform.position = [...first.transform.position];
      obj.transform.rotation = [...first.transform.rotation];
    });
  }

  addStep(name) {
    const step = { id: crypto.randomUUID(), name, index: this.steps.length };
    this.steps.push(step);
    return step;
  }

  async importJSON(data, fetchDetails) {
    this.clear();
    this.steps = Object.entries(data.steps || {}).map(([id, s]) => ({
      id,
      name: s.name,
      index: s.index || 0
    }));
    if (!this.steps.length) {
      const def = { id: crypto.randomUUID(), name: 'Step 1', index: 0 };
      this.steps = [def];
    }
    this.steps.sort((a, b) => a.index - b.index);
    const entries = Object.entries(data.slots || {});
    for (const [id, slotData] of entries) {
      const objects = [];
      for (const objData of slotData.objects || []) {
        const details = await fetchDetails(objData.uuid);
        if (!details) continue;
        objects.push({
          uuid: objData.uuid,
          name: details.name,
          materials: details.materials || [],
          selectedMaterial: 0,
          transform: {
            position: objData.position || [0, 0, 0],
            rotation: objData.rotation || [0, 0, 0],
            scale: objData.scale || [1, 1, 1]
          }
        });
      }
      this.addSlotFromData(id, slotData.name, objects, slotData.canBeEmpty, slotData.step || this.steps[0].id);
    }
  }

  exportJSON() {
    const stepsOut = {};
    this.steps.forEach(step => {
      stepsOut[step.id] = { name: step.name, index: step.index };
    });
    const slotsOut = {};
    this.slots.forEach(slot => {
      slotsOut[slot.id] = {
        name: slot.name,
        canBeEmpty: slot.canBeEmpty,
        step: slot.stepId,
        objects: slot.objects.map(o => ({
          uuid: o.uuid,
          position: o.transform.position,
          rotation: o.transform.rotation,
          scale: o.transform.scale
        }))
      };
    });
    return JSON.stringify({ steps: stepsOut, slots: slotsOut }, null, 2);
  }
}
