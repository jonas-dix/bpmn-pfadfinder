import { defineStore } from "pinia";
import type { FilterOption, Gateway } from "@/types/bpmn";

export const useBpmnStore = defineStore("bpmn", {
  state: () => ({
    bpmnXml: null as string | null,
    selectedFileName: null as string | null,

    rawPaths: [] as string[][],
    mergedPaths: [] as string[][],
    gateways: [] as Gateway[],

    program: "Merged paths" as "Raw paths" | "Merged paths",

    selectedElementId: null as string | null,
    selectedPathIndex: null as number | null,
    filterOptions: [] as FilterOption[],

    selectedPath: [] as string[],
  }),
});

// export const useBpmnStore = defineStore("bpmn", () => {
//   const bpmnXml = ref<string | null>(null);
//   const selectedFileName = ref<string | null>(null);

//   const rawPaths = ref<string[][]>([]);
//   const gateways = ref<Gateway[]>([]);
//   const mergedPaths = ref<string[][]>([]);

//   const selectedPath = ref<string[]>([]);
//   const program = ref<"Raw paths" | "Merged paths">("Merged paths");
//   // const paths = computed(() => {
//   //   if (program.value === "Raw paths") {
//   //     return rawPaths.value;
//   //   } else {
//   //     return mergedPaths.value;
//   //   }
//   // });
//   const selectedElementId = ref<string | null>(null);
//   // const filteredIndices = computed<number[]>(() => {
//   //   const sel = selectedElementId.value;
//   //   let indices = Array.from({ length: paths.value.length }, (_, i) => i);

//   //   if (sel) {
//   //     indices = indices.filter((i) => paths.value[i].includes(sel));
//   //   }

//   //   return indices;
//   // });
//   // const consideredPaths = computed<string[][]>(() =>
//   //   filteredIndices.value.map((i) => paths.value[i])
//   // );
//   const selectedPathIndex = ref<number | null>(null);
//   const filterOptions = ref<FilterOption[]>([]);

//   return {
//     bpmnXml,
//     selectedFileName,
//     gateways,
//     rawPaths,
//     mergedPaths,
//     selectedPath,
//     program,
//     selectedElementId,
//     selectedPathIndex,
//     filterOptions,
//   };
// });
