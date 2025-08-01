<script setup lang="ts">
import { ref, onMounted, shallowRef } from "vue";
import { useBpmnStore } from "@/stores/bpmn";
import { useBpmnModeler } from "@/composables/useBpmnViewer";
import { useDownloadDiagram } from "@/composables/useDownloadDiagram";
import { reduceDiagramToPath } from "@/utils/newBpmn";
import router from "@/router";

import type { Element } from "bpmn-js/lib/model/Types";

const bpmnStore = useBpmnStore();
const diagramContainer = shallowRef<HTMLElement | null>(null);
const { modeler, canvas, elementRegistry, modeling, initModeler } =
  useBpmnModeler();
const { downloadDiagram } = useDownloadDiagram(modeler);

const downloadFileName = ref<string | null>(null);

onMounted(async () => {
  try {
    if (
      !diagramContainer.value ||
      !bpmnStore.bpmnXml ||
      bpmnStore.selectedPathIndex === null ||
      !bpmnStore.selectedFileName
    ) {
      throw new Error("Fehlende Daten für Diagramm");
    }
    initModeler(diagramContainer.value);

    if (!elementRegistry.value || !modeling.value)
      throw new Error("Modellzugriff fehlgeschlagen.");

    await modeler.value?.importXML(bpmnStore.bpmnXml);

    // Benutzeraktionen sperren
    if (canvas.value) {
      canvas.value.getContainer().style.pointerEvents = "none";
    }

    // Sichtbarkeit des Diagramms
    canvas.value?.zoom("fit-viewport");

    const path = bpmnStore.consideredPaths[bpmnStore.selectedPathIndex];

    reduceDiagramToPath(path, elementRegistry.value, modeling.value);

    if (bpmnStore.program === "Merged paths") {
      downloadFileName.value =
        bpmnStore.selectedFileName.slice(0, -5) +
        "_merged_path_" +
        bpmnStore.selectedPathIndex +
        ".bpmn";
    } else if (bpmnStore.program === "Raw paths") {
      downloadFileName.value =
        bpmnStore.selectedFileName.slice(0, -5) +
        "_raw_path_" +
        bpmnStore.selectedPathIndex +
        ".bpmn";
    }
  } catch (error) {
    console.error("Fehler beim Importieren des BPMN:", error);
    alert("Fehler beim Laden des BPMN.");
  }
});

const handleDownload = async () => {
  try {
    await downloadDiagram(downloadFileName.value);
  } catch (error) {
    console.error("Fehler beim Herunterladen:", error);
    alert("Diagramm konnte nicht heruntergeladen werden.");
  }
};
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
      @click="handleDownload"
      class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
    >
      ⬇ Diagramm herunterladen
    </button>

    <h2 class="text-lg font-semibold mb-2">Pfad-Diagramm</h2>
    <div ref="diagramContainer" class="w-full h-[500px] border"></div>
  </div>
</template>
