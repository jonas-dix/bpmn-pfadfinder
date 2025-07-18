<script setup lang="ts">
import BpmnViewer from "bpmn-js";
import { onMounted, ref } from "vue";

const viewer = ref<BpmnViewer>();

// Erstelle Viewer-Instanz mit id=diagramm nach dem Mount
onMounted(() => {
  viewer.value = new BpmnViewer({ container: "#diagramm" });
});

/**
 * Lädt ein BPMN-Diagramm aus einer XML-Datei
 */
const loadDiagramm = async (event: Event) => {
  // Datei aus dem <input> extrahieren
  const file = (event.target as HTMLInputElement).files?.[0]; // "as" als type assertion. .files eigenschaft kann null sein, daher ?. erstes element aus file liste ausgewählt.

  // Der Typ von file ist danach File
  if (!file) {
    console.error("Keine Datei ausgewählt.");
    alert("Fehler beim Auswählen der Datei.");
    return;
  }

  // Prüfe, ob die Datei das richtige Format hat
  // if (!file.name.endsWith(".bpmn") && !file.name.endsWith(".xml")) {
  //   console.error("Ungültiger Dateityp:", file.name);
  //   alert("Bitte laden Sie eine BPMN- oder XML-Datei.");
  //   return;
  // }

  const reader = new FileReader();

  // Wenn Datei gelesen wurde, wird reader initialisiert
  reader.onload = () => {
    try {
      const bpmnXML = reader.result as string;
      viewer.value?.importXML(bpmnXML);
    } catch (error) {
      console.error("Fehler beim Parsen der BPMN-Datei:", error);
      alert("Das BPMN-Diagramm konnte nicht geladen werden.");
    }
  };

  // Event-Handler onerror wird initialisiert
  reader.onerror = () => {
    console.error("Fehler beim Lesen der Datei:", reader.error);
    alert("Beim Einlesen der Datei ist ein Fehler aufgetreten.");
  };

  // Starte Lesen der Datei
  reader.readAsText(file);
};

// const printXML = async (event: Event) => {
//   const file = (event.target as HTMLInputElement).files?.[0];
//   console.log(file);
//   const reader = new FileReader();
//   reader.onload = () => {
//     const xmlText = reader.result as string;
//     console.log(xmlText);
//   };
//   // FileReader erbt von EventTarget: .onload Eventhandler, aufgerufen wenn Lesevorgang abgeschlossen
//   reader.readAsText(file);
// };
</script>

<template>
  <input type="file" accept=".bpmn" @change="loadDiagramm" />

  <div
    id="diagramm"
    style="width: 100%; height: 600px; border: 1px solid #ccc"
  ></div>
</template>
