import { Ref } from "vue";
import router from "@/router";
import { useBpmnStore } from "@/stores/bpmn";

export function usePathNavigation(
  program: Ref<"Raw paths" | "Merged paths">,
  consideredPaths: Ref<string[][]>,
  selectedPathIndex: Ref<number | null>,
  selectedElementId: Ref<string | null>,
  highlightPath: () => void
) {
  const bpmnStore = useBpmnStore();

  /**
   * Der Nächste Pfad wird ausgewählt
   */
  const nextPath = () => {
    if (consideredPaths.value.length === 0) {
      throw new Error("Es gibt keine Pfade zur Auswahl.");
    } else {
      if (
        selectedPathIndex.value === null ||
        selectedPathIndex.value === consideredPaths.value.length - 1
      ) {
        selectedPathIndex.value = 0;
      } else if (selectedPathIndex.value < consideredPaths.value.length - 1) {
        selectedPathIndex.value++;
      }
      highlightPath();
    }
  };

  /**
   * Der vorherige Pfad wird ausgewählt.
   */
  const previousPath = () => {
    if (consideredPaths.value.length === 0) {
      throw new Error("Es gibt keine Pfade zur Auswahl.");
    } else {
      if (selectedPathIndex.value === null || selectedPathIndex.value === 0) {
        selectedPathIndex.value = consideredPaths.value.length - 1;
      } else if (selectedPathIndex.value > 0) {
        selectedPathIndex.value--;
      }
      highlightPath();
    }
  };

  /**
   * Switcht zwischen allen einzelnen Pfaden und den zusammengeführten Pfaden.
   */
  const toggleProgram = () => {
    if (program.value === "Raw paths") {
      program.value = "Merged paths";
    } else if (program.value === "Merged paths") {
      program.value = "Raw paths";
    }

    if (consideredPaths.value.length === 0) {
      throw new Error("Es gibt keine Pfade zur Auswahl.");
    } else {
      selectedPathIndex.value = 0;
      highlightPath();
    }
  };

  /**
   * Leitet auf die Seite weiter, in der das Pfad-Diagramm angezeigt wird.
   */
  const goToPathDiagram = () => {
    if (selectedPathIndex.value === null) {
      throw new Error("Kein Pfad ausgewählt.");
    }

    bpmnStore.program = program.value;
    bpmnStore.selectedPathIndex = selectedPathIndex.value;
    bpmnStore.selectedElementId = selectedElementId.value;
    bpmnStore.selectedPath = consideredPaths.value[selectedPathIndex.value];

    router.push({
      name: "pathdiagram",
    });
  };

  const reactToFilter = () => {
    if (consideredPaths.value.length === 0) {
      throw new Error("Es gibt keine Pfade zur Auswahl.");
    }
    if (selectedPathIndex.value === null) {
      return;
    }
    selectedPathIndex.value = 0;
    highlightPath();
  };

  return {
    nextPath,
    previousPath,
    toggleProgram,
    goToPathDiagram,
    reactToFilter,
  };
}
