export class ConfiguratorState {
  constructor() {
    this.slots = [];
    this.currentSlotIndex = -1;
  }

  clear() {
    this.slots = [];
    this.currentSlotIndex = -1;
  }

  addSlot(name = 'New slot') {
    const slot = {
      id: crypto.randomUUID(),
      name,
      objects: [],
      selectedObjectIndex: -1
    };
    this.slots.push(slot);
    this.currentSlotIndex = this.slots.length - 1;
    return slot;
  }

  addSlotFromData(id, name, objects = []) {
    const slot = {
      id,
      name,
      objects,
      selectedObjectIndex: objects.length ? 0 : -1
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

  exportJSON() {
    const slotsOut = {};
    this.slots.forEach(slot => {
      slotsOut[slot.id] = {
        name: slot.name,
        objects: slot.objects.map(o => ({
          uuid: o.uuid,
          position: o.transform.position,
          rotation: o.transform.rotation,
          scale: o.transform.scale
        }))
      };
    });
    return JSON.stringify({ slots: slotsOut }, null, 2);
  }
}
