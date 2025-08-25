import { computed } from "vue";
import { useBpmnStore } from "@/stores/bpmn";

export function useBpmnSelectors() {
  const bpmnStore = useBpmnStore();

  const paths = computed(() => {
    if (bpmnStore.program === "Raw paths") {
      return bpmnStore.rawPaths;
    } else {
      return bpmnStore.mergedPaths;
    }
  });

  const filteredIndices = computed<number[]>(() => {
    const sel = bpmnStore.selectedElementId;
    let indices = Array.from({ length: paths.value.length }, (_, i) => i);

    if (sel) {
      indices = indices.filter((i) => paths.value[i].includes(sel));
    }

    return indices;
  });

  const consideredPaths = computed<string[][]>(() =>
    filteredIndices.value.map((i) => paths.value[i])
  );

  const selectedPath = computed(() => {
    if (bpmnStore.program === "Raw paths") {
      return bpmnStore.rawPaths[bpmnStore.selectedPathIndex];
    } else {
      return bpmnStore.mergedPaths[bpmnStore.selectedPathIndex];
    }
  });

  return {
    filteredIndices,
    consideredPaths,
    selectedPath,
  };
}
