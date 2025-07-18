<script setup lang="ts">
import { ref, onMounted } from "vue";
import BpmnViewer from "bpmn-js";

const bpmnContainer = ref<HTMLElement | null>(null);
let viewer: BpmnViewer;

onMounted(() => {
  viewer = new BpmnViewer({ container: bpmnContainer.value! });
});

const loadDiagram = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await viewer.importXML(reader.result as string);
    } catch (err) {
      console.error("Fehler beim Laden des BPMN:", err);
    }
  };
  reader.readAsText(file);
};
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Datei auswählen -->
    <input type="file" accept=".bpmn,.xml" @change="loadDiagram" />

    <!-- Hier wird das Diagramm angezeigt -->
    <div ref="bpmnContainer" class="w-full h-[500px] border border-gray-300" />
  </div>
</template>
