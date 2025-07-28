import { shallowRef, ref } from "vue";
import ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type Canvas from "diagram-js/lib/core/Canvas";
import Viewer from "bpmn-js/lib/Viewer";

export function useBpmnViewer() {
  const canvas = shallowRef<Canvas | null>(null);
  const elementRegistry = shallowRef<ElementRegistry | null>(null);
  const viewer = shallowRef<Viewer | null>(null);

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
