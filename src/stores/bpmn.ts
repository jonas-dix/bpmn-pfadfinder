import { ref, computed } from "vue";
import { defineStore } from "pinia";
import type { Gateway } from "@/types/bpmn";

export const useBpmnStore = defineStore("bpmn", () => {
  const bpmnXml = ref<string | null>(null);
  const selectedFileName = ref<string>("");
  const gateways = ref<Gateway[]>([]);
  const rawPaths = ref<string[][]>([]);
  const mergedPaths = ref<string[][]>([]);
  const niceMergedPaths = ref<string[][]>([]);
  const program = ref<string>("Merged paths");
  const consideredPaths = computed(() => {
    if (program.value === "Raw paths") {
      return rawPaths.value;
    } else if (program.value === "Merged paths") {
      return mergedPaths.value;
    }
    return [];
  });
  const selectedPathIndex = ref<number | null>(null);

  return {
    bpmnXml,
    selectedFileName,
    gateways,
    rawPaths,
    mergedPaths,
    niceMergedPaths,
    program,
    consideredPaths,
    selectedPathIndex,
  };
});
