import { nicePath } from "@/utils/formatting";
import type { Ref } from "vue";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type { Gateway, Verbose } from "@/types/bpmn";
import type Canvas from "diagram-js/lib/core/Canvas";

export function usePathHighlighting(
  canvas: Ref<Canvas | null>,
  elementRegistry: Ref<ElementRegistry | null>,
  gateways: Ref<Gateway[]>,
  consideredPaths: Ref<string[][]>,
  selectedPathIndex: Ref<number | null>,
  VERBOSE: Verbose = {}
) {
  /**
   * Der ausgewählte Pfad im Diagramm wird hervorgehoben.
   */
  const highlightPath = () => {
    if (!elementRegistry.value) {
      throw new Error("ElementRegistry ist nicht initialisiert.");
    }
    if (!canvas.value) {
      throw new Error("Canvas ist nicht initialisiert.");
    }
    if (selectedPathIndex.value === null) {
      throw new Error("Kein Pfad ausgewählt.");
    }

    const path = consideredPaths.value[selectedPathIndex.value];

    // Markierungen entfernen
    elementRegistry.value.forEach((el) =>
      canvas.value!.removeMarker(el.id, "highlight")
    );

    if (VERBOSE.overview) {
      console.log(
        "Highlighted Path:",
        nicePath(path, gateways.value, elementRegistry.value)
      );
    }

    for (let i = 0; i < path.length; i++) {
      const elementId = path[i];
      const element = elementRegistry.value.get(elementId);
      if (element) {
        canvas.value.addMarker(elementId, "highlight");
      }
      if (i < path.length - 1) {
        const nextElementId = path[i + 1];
        const outgoing = element?.businessObject?.outgoing || [];
        for (const flow of outgoing) {
          if (flow.targetRef.id === nextElementId) {
            canvas.value.addMarker(flow.id, "highlight");
            const gfx = canvas.value.getGraphics(flow.id);
            if (gfx) {
              gfx.setAttribute("data-type", "bpmn:SequenceFlow");
            }
          }
        }
      }
    }
  };

  return { highlightPath };
}
