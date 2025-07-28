import { Ref } from "vue";

export function usePathNavigation(
  program: Ref<string>,
  consideredPaths: Ref<string[][]>,
  selectedPathIndex: Ref<number | null>,
  highlightPath: () => void
) {
  /**
   * Der Nächste Pfad wird angewählt
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
   * Der vorherige Pfad wird angewählt.
   */
  const previousPath = () => {
    if (consideredPaths.value.length === 0) {
      console.error("Es gibt keine Pfade zur Auswahl.");
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
      console.error("Es gibt keine Pfade zur Auswahl.");
      selectedPathIndex.value = null;
    } else {
      selectedPathIndex.value = 0;
      highlightPath();
    }
  };

  return { nextPath, previousPath, toggleProgram };
}
