<script setup lang="ts">
// --------------- Imports ---------------
import { computed, onMounted, ref, shallowRef } from "vue";

// Stores, Types, Error
import { useBpmnStore } from "@/stores/bpmn";
import type { Element } from "diagram-js/lib/model";
import type { Gateway } from "@/types/bpmn";
import { UserInputError } from "@/utils/error";

// Composables für Viewer, Pfad-Markierung & Navigation
import { useBpmnViewer } from "@/composables/useBpmnViewer";
import { usePathHighlighting } from "@/composables/usePathHighlighting";
import { usePathNavigation } from "@/composables/usePathNavigation";

// Hilfsfunktionen zur Pfadanalyse & Formatierung
import { findRawPaths, linkGateways, mergePaths } from "@/utils/pathAnalysis";
import { createMergedPaths, nicePathList } from "@/utils/formatting";

// --------------- Konfiguration ---------------
const config = {
  defaultProgram: "Merged paths" as "Raw paths" | "Merged paths",
  maxDepth: 15,
  verboseFlags: {
    rawPaths: false,
    gateways: false,
    merging: true,
    mapping: false,
    overview: true,
  },
};

// --------------- Zustände für Diagramm, Analyse, UI, Store, Debug ---------------
const diagramContainer = shallowRef<HTMLElement | null>(null);
const selectedFileName = ref<string | null>(null);

const maxDepth = ref<number>(config.maxDepth);
const gateways = ref<Gateway[]>([]);
const rawPaths = ref<string[][]>([]);
const mergedPaths = ref<string[][]>([]);

const program = ref<"Raw paths" | "Merged paths">(config.defaultProgram);
const consideredPaths = computed(() => {
  if (program.value === "Raw paths") {
    return rawPaths.value;
  } else {
    return mergedPaths.value;
  }
});
const selectedPathIndex = ref<number | null>(null);

const bpmnStore = useBpmnStore();

const VERBOSE = config.verboseFlags;

// --------------- Initialisierung von Viewer, Highlighting & Navigation ---------------
const { viewer, canvas, elementRegistry, initViewer } = useBpmnViewer();
const { highlightPath } = usePathHighlighting(
  canvas,
  elementRegistry,
  gateways,
  consideredPaths,
  selectedPathIndex,
  VERBOSE
);
const { nextPath, previousPath, toggleProgram, goToPathDiagram } =
  usePathNavigation(program, consideredPaths, selectedPathIndex, highlightPath);

onMounted(async () => {
  if (!diagramContainer.value) {
    console.error("DiagramContainer existiert nicht.");
    alert("Fehler beim Bereitstellen der Diagramm-Anzeige.");
    return;
  }

  initViewer(diagramContainer.value);

  try {
    // Falls das BPMN bereits gespeichert ist durch vorherigen Aufruf
    if (bpmnStore.bpmnXml) {
      // BPMN in Viewer importieren
      await viewer.value?.importXML(bpmnStore.bpmnXml);

      // Sichtbarkeit des Diagramms
      canvas.value?.zoom("fit-viewport");

      // Wiederherstellung des vorherigen Zustandes aus dem Store
      selectedFileName.value = bpmnStore.selectedFileName;
      gateways.value = bpmnStore.gateways;
      rawPaths.value = bpmnStore.rawPaths;
      mergedPaths.value = bpmnStore.mergedPaths;
      program.value = bpmnStore.program;
      selectedPathIndex.value = bpmnStore.selectedPathIndex;

      // Aktuellen Pfad hervorheben
      if (selectedPathIndex.value !== null) highlightPath();
    }
  } catch (error) {
    console.error("Fehler beim Re-Importieren des BPMN:", error);
    alert("Fehler beim Laden des BPMN.");
  }
});

const loadDiagramm = async (event: Event) => {
  // Datei aus dem <input> extrahieren
  const file = (event.target as HTMLInputElement).files?.[0];

  // Filename lokal und im Store speichern
  selectedFileName.value = file?.name || null;
  bpmnStore.selectedFileName = file?.name || null;

  if (!file) {
    console.warn("Keine Datei ausgewählt.");
    return;
  }

  // Analyse- und UI-Daten zurücksetzen
  rawPaths.value = [];
  gateways.value = [];
  mergedPaths.value = [];
  program.value = "Merged paths";
  selectedPathIndex.value = null;

  // Reader initialisieren
  const reader = new FileReader();
  reader.onload = async () => {
    const bpmnXML = reader.result as string;

    // Speicher BPMN in Store
    bpmnStore.bpmnXml = bpmnXML;

    try {
      // BPMN in Viewer importieren
      await viewer.value?.importXML(bpmnXML);

      // Sichtbarkeite des Diagramms
      canvas.value?.zoom("fit-viewport");
    } catch (error) {
      console.error("Fehler beim Importieren der BPMN-Datei:", error);
      alert("Fehler beim Laden des BPMN.");
    }
  };

  // Reader starten
  reader.readAsText(file);
};

const analyzePaths = () => {
  try {
    if (!elementRegistry.value) {
      throw new Error("ElementRegistry ist nicht initialisiert.");
    }

    // Schritt 0: Start-Element aus dem Diagramm extrahieren
    const startElement = elementRegistry.value
      .getAll()
      .find((el) => el.type === "bpmn:StartEvent") as Element;

    if (!startElement) {
      throw new UserInputError("Kein Start-Event gefunden.");
    }

    // Schritt 1: Einzelne, rohe Pfade berechnen und Gateways sammeln
    const { allRawPaths, allGateways } = findRawPaths(
      startElement,
      elementRegistry.value,
      maxDepth.value,
      VERBOSE
    );
    rawPaths.value = allRawPaths;
    gateways.value = allGateways;

    if (VERBOSE.overview) {
      console.log(
        "All raw paths:",
        nicePathList(rawPaths.value, gateways.value, elementRegistry.value)
      );
      console.log(
        "All unlinked gateways:",
        allGateways.map((gw) => [
          gw.id,
          gw.type,
          gw.direction,
          gw.incoming,
          gw.outgoing,
          gw.loop,
        ])
      );
    }

    // Schritt 2: Gateways verknüpfen
    linkGateways(gateways.value, rawPaths.value, VERBOSE);

    if (VERBOSE.overview) {
      console.log(
        "All linked Gateways:",
        gateways.value.map((gw) => [
          gw.id,
          gw.type,
          gw.direction,
          gw.incoming,
          gw.outgoing,
          gw.counterpart,
          gw.loop,
        ])
      );
    }

    // Schritt 3: Pfade als Mapping mergen und Deadlocks identifizieren
    const { mapping, deadlockPaths } = mergePaths(
      rawPaths.value,
      gateways.value,
      VERBOSE
    );

    if (VERBOSE.overview) {
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
    }

    // Schritt 4: Gemergte Pfade erzeugen
    mergedPaths.value = createMergedPaths(
      mapping,
      rawPaths.value,
      deadlockPaths
    );

    if (VERBOSE.overview)
      console.log(
        "All merged paths:",
        nicePathList(rawPaths.value, gateways.value, elementRegistry.value)
      );
  } catch (error) {
    program.value = "Raw paths";
    if (error instanceof UserInputError) {
      console.error("Das Diagramm ist fehlerhaft: " + (error as Error).message);
      alert("Das Diagramm ist fehlerhaft: " + (error as Error).message);
    } else {
      console.error("Fehler bei der Pfadanalyse:", error);
      alert("Ein Fehler bei der Pfadanalyse ist aufgetreten.");
    }
  }

  // Zustand im Store speichern
  bpmnStore.gateways = gateways.value;
  bpmnStore.rawPaths = rawPaths.value;
  bpmnStore.mergedPaths = mergedPaths.value;
};

function withError(fn: () => void) {
  try {
    fn();
  } catch (error) {
    alert((error as Error).message);
  }
}
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
    <div ref="diagramContainer" class="w-full h-[500px] border"></div>

    <!-- Rechte Seitenleiste -->
    <div class="w-1/4 flex flex-col gap-2">
      <button
        v-if="selectedPathIndex !== null"
        @click="withError(goToPathDiagram)"
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
      @change="withError(highlightPath)"
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
    <button @click="withError(previousPath)" class="px-3 py-1 border rounded">
      ◀
    </button>
    <button @click="withError(nextPath)" class="px-3 py-1 border rounded">
      ▶
    </button>

    <!-- Programm-Umschalter -->
    <button
      @click="withError(toggleProgram)"
      class="ml-2 px-3 py-1 border rounded"
    >
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

<!-- 
Loops:
Loop soll nur einmal durchlaufen werden
Mergen schlägt fehl, wenn gateways mehrmals auftreten: Idee in mergePaths mehrmals mergepathsatgateway anwenden
mit zusätzlichem argument n, das den n-ten Auftritt des gateways beschreibt
-->

<!-- Komischerweise: Wenn ich das Diagramm auf der Website manuell lade, muss ich businessObject benutzen
  (sonst outgoing ohne informationen) und nur per ID auf nextElement zugreifen.
  flow.target ist nicht stabil, bei externem XML-import.
  übrigens bei moddle gibt es businessObject nicht, dort würde man currentElement.outgoing verwenden -->

<!-- git add. git commit -m "..." git push -->

<!-- npx tsc --noEmit -->

<!-- To Do:
Loops behandeln
zwei start option abgdecken
Funktion hinzufügen: Durch eingeben eines Tasks in der Suchleiste werden Pfade gefiltert, die durch dieses Task gehen.
Annotation zu Pfad-Diagramm mit getroffenen Entscheidungen hinzufügen
Mit Cedric über Integration in bpmn modeler reden 
Daniel oder Andre anschreiben, wegen Jobsuche: Schmiede, Front-End-Developer
Schulung machen (vue, node, atlassian)-->

<!-- Später:
 Problem der Reihenfolge bei inclusive Gateways
 Code in Klassen aufschreiben, sodass Algorithmen ausgewählt werden können -->
