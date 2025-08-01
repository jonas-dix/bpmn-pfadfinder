import { shallowRef } from "vue";
import ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import Viewer from "bpmn-js/lib/Viewer";
import Modeler from "bpmn-js/lib/Modeler";
import type Canvas from "diagram-js/lib/core/Canvas";
import type Modeling from "bpmn-js/lib/features/modeling/Modeling";

export function useBpmnViewer() {
  const viewer = shallowRef<Viewer | null>(null);
  const canvas = shallowRef<Canvas | null>(null);
  const elementRegistry = shallowRef<ElementRegistry | null>(null);

  const initViewer = (conatinerEl: HTMLElement) => {
    viewer.value = new Viewer({ container: conatinerEl });
    elementRegistry.value = viewer.value.get("elementRegistry");
    canvas.value = viewer.value.get("canvas");
  };

  return {
    viewer,
    canvas,
    elementRegistry,
    initViewer,
  };
}

export function useBpmnModeler() {
  const modeler = shallowRef<Modeler | null>(null);
  const canvas = shallowRef<Canvas | null>(null);
  const elementRegistry = shallowRef<ElementRegistry | null>(null);
  const modeling = shallowRef<Modeling | null>(null);

  const initModeler = (conatinerEl: HTMLElement) => {
    // modeler.value = new Modeler({ container: conatinerEl });
    modeler.value = new Modeler({
      container: conatinerEl,
      keyboard: false,
      additionalModules: [], // keine Erweiterungen laden
      moddleExtensions: {},
    });
    canvas.value = modeler.value.get("canvas");
    elementRegistry.value = modeler.value.get("elementRegistry");
    modeling.value = modeler.value.get("modeling");
  };

  return {
    modeler,
    canvas,
    elementRegistry,
    modeling,
    initModeler,
  };
}
