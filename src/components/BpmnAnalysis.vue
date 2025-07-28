<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useBpmnStore } from "@/stores/bpmn";

import type { Element } from "diagram-js/lib/model";
import type { Gateway } from "@/types/bpmn";

import { usePathNavigation } from "@/composables/usePathNavigation";
import { useBpmnViewer } from "@/composables/useBpmnViewer";
import { usePathHighlighting } from "@/composables/usePathHighlighting";

const bpmnStore = useBpmnStore();
const router = useRouter();

// --- Diagramm-Referenz ---
const diagramContainer = ref<HTMLElement | null>(null);
const selectedFileName = ref<string>();

// --- Pfadanalyse ---
const gateways = ref<Gateway[]>([]);
const rawPaths = ref<string[][]>([]);
const mergedPaths = ref<string[][]>([]);
const niceMergedPaths = ref<string[][]>([]);

// --- UI-Zustand ---
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

let verbose = [false, false];

const { viewer, canvas, elementRegistry, initViewer } = useBpmnViewer();

const { highlightPath } = usePathHighlighting(
  canvas,
  elementRegistry,
  gateways,
  consideredPaths,
  selectedPathIndex
);

const { nextPath, previousPath, toggleProgram } = usePathNavigation(
  program,
  consideredPaths,
  selectedPathIndex,
  highlightPath
);

import { findRawPaths, linkGateways, mergePaths } from "@/utils/pathAnalysis";
import { createMergedPaths, nicePathList } from "@/utils/formatting";

onMounted(async () => {
  if (!diagramContainer.value) return;
  initViewer(diagramContainer.value);

  if (bpmnStore.bpmnXml) {
    try {
      await viewer.value?.importXML(bpmnStore.bpmnXml);
      canvas.value?.zoom("fit-viewport");
    } catch (error) {
      console.error("Fehler beim Re-Importieren des BPMN:", error);
    }
    selectedFileName.value = bpmnStore.selectedFileName;
    gateways.value = bpmnStore.gateways;
    rawPaths.value = bpmnStore.rawPaths;
    mergedPaths.value = bpmnStore.mergedPaths;
    niceMergedPaths.value = bpmnStore.niceMergedPaths;
    program.value = bpmnStore.program;
    selectedPathIndex.value = bpmnStore.selectedPathIndex;
    highlightPath();
  }
});

const loadDiagramm = async (event: Event) => {
  // Datei aus dem <input> extrahieren
  const file = (event.target as HTMLInputElement).files?.[0];
  selectedFileName.value = file?.name;
  bpmnStore.selectedFileName = selectedFileName.value || "";

  if (!file) {
    console.warn("Keine Datei ausgewählt.");
    return;
  }

  // Werte zurücksetzen
  gateways.value = [];
  rawPaths.value = [];
  mergedPaths.value = [];
  program.value = "Merged paths";
  selectedPathIndex.value = null;

  const reader = new FileReader();

  reader.onload = async () => {
    const bpmnXML = reader.result as string;
    bpmnStore.bpmnXml = bpmnXML;

    try {
      await viewer.value?.importXML(bpmnXML);
      canvas.value?.zoom("fit-viewport");
    } catch (error) {
      console.error("Fehler beim Importieren der BPMN-Datei:", error);
      alert("Das BPMN-Diagramm konnte nicht geladen werden.");
    }
  };

  reader.readAsText(file);
};

const analyzePaths = () => {
  try {
    if (!elementRegistry.value) {
      throw new Error("ElementRegistry ist nicht initialisiert.");
    }

    const startElement = elementRegistry.value
      .getAll()
      .find((el) => el.type === "bpmn:StartEvent") as Element;

    const { allRawPaths, allGateways } = findRawPaths(
      startElement,
      elementRegistry.value
    );
    rawPaths.value = allRawPaths;
    gateways.value = allGateways;

    linkGateways(gateways.value, rawPaths.value);

    // console.log(
    //   "Gateways mit counterparts:",
    //   gateways.value.map((gw) => [
    //     gw.id,
    //     gw.incoming,
    //     gw.type,
    //     gw.outgoing,
    //     gw.counterpart,
    //   ])
    // );

    console.log(
      "All raw paths:",
      nicePathList(rawPaths.value, gateways.value, elementRegistry.value)
    );

    const { mapping, deadlockPaths } = mergePaths(
      rawPaths.value,
      gateways.value,
      verbose
    );
    console.log(
      "Mapping of raw paths:",
      mapping.map((comb) => comb.map((i) => i + 1))
    );
    console.log(
      "All deadlock paths:",
      deadlockPaths.map((deadlockPath) => [
        deadlockPath.pathIndex + 1,
        deadlockPath.breakup,
      ])
    );

    mergedPaths.value = createMergedPaths(
      mapping,
      deadlockPaths,
      rawPaths.value
    );
    console.log("All merged paths:", mergedPaths.value);

    niceMergedPaths.value = nicePathList(
      rawPaths.value,
      gateways.value,
      elementRegistry.value
    );
    console.log("All nice merged paths:", niceMergedPaths.value);
  } catch (err) {
    console.error("Fehler bei der Pfadanalyse:", err);
    alert((err as Error).message);
  }
  bpmnStore.gateways = gateways.value;
  bpmnStore.rawPaths = rawPaths.value;
  bpmnStore.mergedPaths = mergedPaths.value;
  bpmnStore.niceMergedPaths = niceMergedPaths.value;
};

const goToPathView = () => {
  if (selectedPathIndex.value === null) return;

  bpmnStore.program = program.value;
  bpmnStore.selectedPathIndex = selectedPathIndex.value;

  router.push({
    name: "pathview",
  });
};
</script>

<template>
  <!-- Datei-Auswahlbereich -->
  <div class="mb-4 flex items-center gap-4">
    <label class="relative inline-block">
      <input
        type="file"
        accept=".bpmn"
        @change="loadDiagramm"
        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div
        class="px-4 py-2 bg-gray-100 text-gray-800 border border-gray-300 rounded shadow-sm hover:bg-gray-200 text-sm"
      >
        Datei auswählen
      </div>
    </label>

    <!-- Dateiname -->
    <span
      v-if="selectedFileName"
      class="text-sm text-gray-700 truncate max-w-xs"
      :title="selectedFileName"
    >
      {{ selectedFileName }}
    </span>
  </div>

  <div class="flex gap-4">
    <!-- Diagramm -->
    <!-- <div ref="diagramContainer" class="w-3/4 h-[400px] border"></div> -->
    <div ref="diagramContainer" class="w-full h-[500px] border"></div>

    <!-- Rechte Seitenleiste -->
    <div class="w-1/4 flex flex-col gap-2">
      <button
        v-if="selectedPathIndex !== null"
        @click="goToPathView"
        class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        Pfad-Diagramm anzeigen
      </button>
    </div>
  </div>

  <!-- Analyse-Button -->
  <button
    v-if="selectedFileName"
    @click="analyzePaths"
    class="ml-auto px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded text-lg font-semibold"
  >
    Pfade analysieren
  </button>

  <!-- Pfad-Steuerung -->
  <div v-if="consideredPaths.length > 0" class="flex items-center gap-4 mt-4">
    <!-- Pfad-Auswahl -->
    <select
      v-model.number="selectedPathIndex"
      @change="highlightPath"
      class="border px-2 py-1 rounded"
    >
      <option :value="null">Pfad auswählen</option>
      <option
        v-for="(path, index) in consideredPaths"
        :key="index"
        :value="index"
      >
        Pfad {{ index + 1 }}
      </option>
    </select>

    <!-- Navigation -->
    <button @click="previousPath" class="px-3 py-1 border rounded">◀</button>
    <button @click="nextPath" class="px-3 py-1 border rounded">▶</button>

    <!-- Programm-Umschalter -->
    <button @click="toggleProgram" class="ml-2 px-3 py-1 border rounded">
      {{ program }}
    </button>
  </div>
</template>

<style>
.djs-element.highlight > .djs-visual > :nth-child(1) {
  stroke: orange !important;
  stroke-width: 4px !important;
  fill-opacity: 0.2 !important;
}
</style>

<!-- Annotation pro Pfad an Start mit Entscheidungen die bei den Exclusive Gateways für diesen Pfad getroffen wurden. -->

<!-- Mit Klassen arbeiten? -->

<!-- !!! Bei mehreren inclusiven Gateways nacheinander (nicht nested), wird die Reihenfolge der Pfade chaotisch -->

<!-- git add. git commit -m "..." git push -->

<!-- npx tsc --noEmit -->

<!-- @ funktioniert nicht immer -->

<!-- Teildiagramm bei 3parallel-exclusive-2parallel-stop falsch, pfad 2 falsch!! -->

<!-- Besprechung:
 auf git pushen version 0.0.1
Testfälle erweitern: Teste ob ausgegebener Pfad der Logik folgt, dass gleichviele Pfade durch split und join gateway gehen, teste Gateway Fehler, teste dass durch parallele immer mehrere pfade gehen.
Funktion hinzufügen: Durch eingeben eines Tasks in der Suchleiste werden Pfade gefiltert, die durch dieses Task gehen.
Annotation zu Pfad-Diagramm mit getroffenen Entscheidungen hinzufügen
Mit Cedric über Integration in bpmn modeler reden 
Daniel oder Andre anschreiben, wegen Jobsuche: Schmiede, Front-End-Developer
Schulung machen (vue, node, atlassian)-->

<!-- Später:
 Problem der Reihenfolge bei inclusive Gateways
 Code in Klassen aufschreiben, sodass Algorithmen ausgewählt werden können -->
