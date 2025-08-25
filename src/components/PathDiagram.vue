<script setup lang="ts">
// -------------------- Imports --------------------
// Vue-Komponenten und Router
import { ref, onMounted, shallowRef } from "vue";
import router from "@/router";

// Store & Composables
import { useBpmnStore } from "@/stores/bpmn";
import { useBpmnModeler } from "@/composables/useBpmnViewer";
import { useDownloadDiagram } from "@/composables/useDownloadDiagram";

// Hilfsfunktionen für die Diagramm-Manipulation
import {
  reduceDiagramToPath,
  addSummaryAnnotationAtStart,
} from "@/utils/newBpmn";

// -------------------- Zustände für Diagramm, Store, Filename ------------------
const diagramContainer = shallowRef<HTMLElement | null>(null);
const bpmnStore = useBpmnStore();
const downloadFileName = ref<string | null>(null);

// -------------------- Composables für Modeler, Diagramm etc. --------------------
const { modeler, canvas, elementRegistry, modeling, initModeler } =
  useBpmnModeler();
const { downloadDiagram } = useDownloadDiagram(modeler);

// -------------------- Diagramm-Initialisierung --------------------
onMounted(async () => {
  try {
    // Prüfe, ob alle benötigten Daten vorhanden sind
    if (
      !diagramContainer.value ||
      !bpmnStore.bpmnXml ||
      !bpmnStore.selectedFileName ||
      bpmnStore.selectedPath.length === 0
    ) {
      throw new Error("Fehlende Daten für Diagramm");
    }

    initModeler(diagramContainer.value);

    if (!elementRegistry.value || !modeling.value || !modeler.value)
      throw new Error("Modellzugriff fehlgeschlagen.");

    await modeler.value?.importXML(bpmnStore.bpmnXml);

    // Sperre Benutzeraktionen im Diagramm
    if (canvas.value) {
      canvas.value.getContainer().style.pointerEvents = "none";
    }

    // const path = bpmnStore.consideredPaths[bpmnStore.selectedPathIndex];
    const path = bpmnStore.selectedPath;

    // Füge Annotation am Start hinzu und reduziere Diagramm auf den Pfad
    addSummaryAnnotationAtStart(
      path,
      modeler.value,
      modeling.value,
      elementRegistry.value
    );
    reduceDiagramToPath(path, elementRegistry.value, modeling.value);

    // Passe die Ansicht an das Diagramm an
    canvas.value?.zoom("fit-viewport");

    // Setze den Dateinamen für den Download je nach Programm-Modus
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
    // Fehlerbehandlung beim Importieren des BPMN
    console.error("Fehler beim Importieren des BPMN:", error);
    alert("Fehler beim Laden des BPMN.");
  }
});

// -------------------- Download-Handler --------------------
// Handler für den Download-Button
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
    <!-- Zurück-Button -->
    <button
      @click="router.back()"
      class="mb-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
    >
      ⬅ Zurück
    </button>

    <!-- Download-Button -->
    <button
      @click="handleDownload"
      class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
    >
      ⬇ Diagramm herunterladen
    </button>

    <!-- Titel -->
    <h2 class="text-lg font-semibold mb-2">Pfad-Diagramm</h2>
    <!-- Diagramm-Container -->
    <div ref="diagramContainer" class="w-full h-[500px] border"></div>
  </div>
</template>
