<script setup lang="ts">
import { ref, onMounted, shallowRef } from "vue";
import { useBpmnStore } from "@/stores/bpmn";
import { useBpmnViewer } from "@/composables/useBpmnViewer";
import { useDownloadDiagram } from "@/composables/useDownloadDiagram";
import { createMinimalBpmnXmlFromPath } from "@/utils/newBpmn";
import router from "@/router";

const bpmnStore = useBpmnStore();
const diagramContainer = shallowRef<HTMLElement | null>(null);
const { viewer, canvas, elementRegistry, initViewer } = useBpmnViewer();
const { downloadDiagram } = useDownloadDiagram(viewer);

const downloadFileName = ref("");

onMounted(async () => {
  if (
    !diagramContainer.value ||
    !bpmnStore.bpmnXml ||
    bpmnStore.selectedPathIndex === null
  ) {
    console.warn("Fehlende Daten für Diagramm");
    console.log(bpmnStore.bpmnXml);
    console.log(bpmnStore.selectedPathIndex);
    return;
  }
  initViewer(diagramContainer.value);

  const path = bpmnStore.consideredPaths[bpmnStore.selectedPathIndex];

  // Erzeuge neues XML mit nur dem ausgewählten Pfad
  const newXml = createMinimalBpmnXmlFromPath(bpmnStore.bpmnXml, path);

  if (!bpmnStore.selectedFileName || bpmnStore.selectedPathIndex === null) {
    throw new Error("Fehler in der Übergabe der Daten.");
  }
  if (bpmnStore.program === "Merged paths") {
    downloadFileName.value =
      bpmnStore.selectedFileName.slice(0, -5) +
      "_merged_path_" +
      bpmnStore.selectedPathIndex +
      ".bpmn";
  } else {
    downloadFileName.value =
      bpmnStore.selectedFileName.slice(0, -5) +
      "_raw_path_" +
      bpmnStore.selectedPathIndex +
      ".bpmn";
  }

  try {
    await viewer.value?.importXML(newXml);
    canvas.value?.zoom("fit-viewport");
  } catch (err) {
    console.error("Fehler beim Anzeigen des Pfaddiagramms:", err);
  }
});
</script>

<template>
  <div class="p-4">
    <button
      @click="router.back()"
      class="mb-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
    >
      ⬅ Zurück
    </button>

    <button
      @click="downloadDiagram(downloadFileName)"
      class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
    >
      ⬇ Diagramm herunterladen
    </button>

    <h2 class="text-lg font-semibold mb-2">Pfad-Diagramm</h2>
    <div ref="diagramContainer" class="w-full h-[500px] border"></div>
  </div>
</template>
