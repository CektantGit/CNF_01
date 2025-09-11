export class ViewerState {
  constructor() {
    this.variants = [];
    this.currentVariantIndex = 0;
    this.slots = [];
    this.steps = [];
    this.environment = null;
    this.currentStepIndex = 0;
  }

  async _buildVariant(src, fetchDetails, fallbackName) {
    let steps;
    if (Array.isArray(src.steps)) {
      steps = src.steps.map((s, i) => ({
        id: s.id || crypto.randomUUID(),
        name: s.name || `Step ${i + 1}`,
        index: s.index ?? i
      }));
    } else {
      steps = Object.entries(src.steps || {}).map(([id, s], i) => ({
        id,
        name: s.name || `Step ${i + 1}`,
        index: s.index ?? i
      }));
    }
    if (!steps.length) {
      const def = { id: crypto.randomUUID(), name: 'Step 1', index: 0 };
      steps = [def];
    }
    steps.sort((a, b) => a.index - b.index);
    const defaultStepId = steps[0].id;

    const slots = [];
    for (const [id, slotData] of Object.entries(src.slots || {})) {
      const slot = {
        id,
        name: slotData.name,
        canBeEmpty: slotData.canBeEmpty,
        textButtons: slotData.textButtons || false,
        objects: [],
        selectedIndex: slotData.canBeEmpty ? -1 : 0,
        open: false,
        currentMesh: null,
        stepId: slotData.step || slotData.stepId || defaultStepId
      };
      for (const obj of slotData.objects || []) {
        const details = await fetchDetails(obj.uuid);
        if (!details) continue;
        slot.objects.push({
          uuid: obj.uuid,
          name: details.name,
          materials: details.materials || [],
          selectedMaterial: 0,
          variationNames: obj.variationNames || (details.materials || []).map(m => m.name),
          transform: {
            position: obj.position || [0, 0, 0],
            rotation: obj.rotation || [0, 0, 0],
            scale: obj.scale || [1, 1, 1]
          },
          mesh: null
        });
      }
      slots.push(slot);
    }
    return { id: src.id || crypto.randomUUID(), name: src.name || fallbackName, steps, slots };
  }

  async loadConfig(data, fetchDetails) {
    this.variants = [];
    this.environment = null;
    if (data.variants) {
      let idx = 1;
      for (const [id, v] of Object.entries(data.variants)) {
        const variant = await this._buildVariant({ ...v, id }, fetchDetails, `Variant ${idx++}`);
        this.variants.push(variant);
      }
    } else {
      const variant = await this._buildVariant(data, fetchDetails, 'Variant 1');
      this.variants.push(variant);
    }
    this.setVariant(0);
    if (data.environment) {
      const det = await fetchDetails(data.environment.uuid);
      if (det) {
        this.environment = {
          uuid: data.environment.uuid,
          materials: det.materials || [],
          selectedMaterial: 0,
          transform: {
            position: data.environment.position || [0, 0, 0],
            rotation: data.environment.rotation || [0, 0, 0],
            scale: data.environment.scale || [1, 1, 1]
          },
          mesh: null
        };
      }
    }
  }

  setVariant(index) {
    this.currentVariantIndex = index;
    const v = this.variants[index];
    this.steps = v.steps.map(s => ({ ...s }));
    this.slots = v.slots.map(s => ({
      ...s,
      open: s.open || false,
      currentMesh: null,
      objects: s.objects.map(o => ({ ...o, mesh: null }))
    }));
    this.currentStepIndex = 0;
  }

  get currentStep() {
    return this.steps[this.currentStepIndex];
  }
}
