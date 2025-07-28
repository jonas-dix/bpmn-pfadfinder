<script setup lang="ts">
import BpmnJS from "bpmn-js";
import { onMounted } from "vue";

const bpmnPfad = "/bpmn-codes/Parallel und Exklusiv GW.bpmn";

// Erstelle Viewer-Instanz mit id=diagramm
onMounted(async () => {
  const viewer = new BpmnJS({ container: "#diagramm" });
  try {
    // asynchron: importiere diagramm
    const response = await fetch(bpmnPfad);
    const bpmnXML = await response.text();
    await viewer.importXML(bpmnXML);
    // zoom
    //viewer.get("diagramm").zoom("fit-viewport");
  } catch (error) {
    console.error("Diagramm konnte nicht geladen werden: ", error);
  }
});
</script>

<template>
  <div
    id="diagramm"
    style="width: 100%; height: 600px; border: 1px solid #ccc"
  ></div>
</template>

<!-- npx tsc --noEmit -->
