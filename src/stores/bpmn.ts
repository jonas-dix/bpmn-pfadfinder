import { ref, computed } from "vue";
import { defineStore } from "pinia";
import type { Gateway } from "@/types/bpmn";

export const useBpmnStore = defineStore("bpmn", () => {
  const bpmnXml = ref<string | null>(null);
  const selectedFileName = ref<string | null>(null);

  const rawPaths = ref<string[][]>([]);
  const gateways = ref<Gateway[]>([]);
  const mergedPaths = ref<string[][]>([]);

  const program = ref<"Raw paths" | "Merged paths">("Merged paths");
  const consideredPaths = computed(() => {
    if (program.value === "Raw paths") {
      return rawPaths.value;
    } else {
      return mergedPaths.value;
    }
  });
  const selectedPathIndex = ref<number | null>(null);

  return {
    bpmnXml,
    selectedFileName,
    gateways,
    rawPaths,
    mergedPaths,
    program,
    consideredPaths,
    selectedPathIndex,
  };
});
