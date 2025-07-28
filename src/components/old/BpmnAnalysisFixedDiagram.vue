<script setup lang="ts">
//import BpmnJS from "bpmn-js";
import BpmnJS from "bpmn-js/lib/Modeler";
import { onMounted } from "vue";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
//import type Modeling from "bpmn-js/lib/features/modeling/Modeling";
import type { Element } from "diagram-js/lib/model";

const bpmnPfad = "/bpmn-codes/ParallelAndExclusive2.bpmn";

// Methoden, Properties loggen
const logMethods = (obj: object) => {
  console.log("All methods of ", obj);
  for (let key in obj) {
    if (typeof obj[key] === "function") {
      console.log(key);
    }
  }
};
const logProperties = (obj: object) => {
  console.log("All properties of ", obj);
  for (let key in obj) {
    if (typeof obj[key] !== "function") {
      console.log(key);
    }
  }
};
const logBusinessObject = (element: object) => {
  console.log("Businesobject of ", element, ": ", element.businessObject);
};

onMounted(async () => {
  // Erstelle Modeler-Instanz mit id=diagramm
  const modeler = new BpmnJS({ container: "#diagramm" });

  try {
    // Importiere Diagramm-Code
    const response = await fetch(bpmnPfad);
    const bpmnXML = await response.text();
    console.log(bpmnXML);

    // Importiere Diagramm-Code in Modeler
    await modeler.importXML(bpmnXML);

    const elementRegistry: ElementRegistry = modeler.get("elementRegistry");
    const allElements = elementRegistry.getAll();
    console.log("Alle BPMN-Elemente:", allElements);

    // const modeling: Modeling = modeler.get("modeling");

    /**
     * Berechnet alle Pfade, ausgehend von currentElement.
     * Exclusive Gateways werden berücksichtigt, bei anderen Gateways wird immer der erste Pfad genommen.
     * @param currentElement
     * @param currentPath
     * @param allPaths
     * @param currentPathByTask
     * @param allPathsByTasks
     */
    const findPaths = function (
      currentElement: Element,
      currentPath: string[] = [],
      allPaths: string[][] = [],
      currentPathByTask: string[] = [],
      allPathsByTasks: string[][] = []
    ) {
      currentPath.push(currentElement.id);

      if (currentElement.type == "bpmn:Task") {
        currentPathByTask.push(currentElement.businessObject.name);
      }

      if (currentElement.type == "bpmn:EndEvent") {
        allPaths.push([...currentPath]); // Speicher Kopie des Arrays
        allPathsByTasks.push([...currentPathByTask]);
        return;
      }

      // Betrachte ausgehende Pfade, wenn wir bei einem Exclusive Gateway sind. Ansonsten wählen wir immer den ersten Pfad.
      let outgoing: Element[];
      if (currentElement.type == "bpmn:ExclusiveGateway") {
        outgoing = currentElement.outgoing || [];
      } else {
        outgoing = [currentElement.outgoing[0]];
        // outgoing = [
        //   currentElement.outgoing[currentElement.outgoing.length - 1],
        // ];
      }

      for (const flow of outgoing) {
        const nextElement = flow.target;
        if (nextElement) {
          findPaths(
            nextElement,
            [...currentPath],
            allPaths,
            [...currentPathByTask],
            allPathsByTasks
          );
        }
      }

      return [allPaths, allPathsByTasks];
    };

    /**
     * Berechnet alle Pfade, ausgehend von currentElement.
     * Alle Gateways werden als Exclusive Gateways aufgefasst.
     * @param currentElement
     * @param currentPath
     * @param allPaths
     * @param currentPathByTask
     * @param allPathsByTasks
     */
    const findPaths1 = function (
      currentElement: Element,
      currentPath: string[] = [],
      allPaths: string[][] = [],
      currentPathByTask: string[] = [],
      allPathsByTasks: string[][] = []
    ) {
      if (currentElement.type == "bpmn:Task") {
        currentPathByTask.push(currentElement.businessObject.name);
      }

      if (currentElement.type == "bpmn:EndEvent") {
        allPaths.push([...currentPath]); // Speicher Kopie des Arrays
        allPathsByTasks.push([...currentPathByTask]);
        return;
      }

      // Betrachte ausgehende Pfade, wenn wir bei einem Exclusive Gateway sind. Ansonsten wählen wir immer den ersten Pfad.
      let outgoing: Element[] = currentElement.outgoing || [];

      if (
        currentElement.type === "bpmn:ParallelGateway" &&
        outgoing.length > 1
      ) {
        currentPath.push({
          type: "ParallelGateway",
          id: currentElement.id,
          outgoingCount: outgoing.length,
        });
      } else {
        currentPath.push(currentElement.id);
      }

      for (const flow of outgoing) {
        const nextElement = flow.target;
        if (nextElement) {
          findPaths1(
            nextElement,
            [...currentPath],
            allPaths,
            [...currentPathByTask],
            allPathsByTasks
          );
        }
      }
      // console.log(allPathsByTasks);
      return [allPaths];
    };

    const mergeParallelPaths = function (allePfade: string[][]) {
      return allePfade;
    };

    // For exclusive and parallel Gateways
    // Weird ...
    /**
     * Berechnet alle Pfade, ausgehend von currentElement.
     * Exclusive Gateways werden berücksichtigt, versucht auch Parallel Gateways zu berücksichtigen.
     * @param currentElement
     * @param currentPath
     * @param allPaths
     * @param currentPathByTask
     * @param allPathsByTasks
     */
    const findPaths2 = function (
      currentElement: Element,
      currentPath: string[] = [],
      allPaths: string[][] = [],
      currentPathByTask: string[] = [],
      allPathsByTasks: string[][] = [],
      lastParallelGateway: Element,
      ParallelPath: Number
    ) {
      currentPath.push(currentElement.id);

      if (currentElement.type == "bpmn:Task") {
        currentPathByTask.push(currentElement.businessObject.name);
      }

      if (currentElement.type == "bpmn:EndEvent") {
        allPaths.push([...currentPath]); // Speicher Kopie des Arrays
        allPathsByTasks.push([...currentPathByTask]);
        return;
      }

      if (lastParallelGateway.type == "bpmn:ParallelGateway") {
      }

      const outgoing = currentElement.outgoing || [];

      for (const flow of outgoing) {
        const nextElement = flow.target;
        if (nextElement) {
          if (
            (lastParallelGateway.type = "bpmn:ParallelGateway") &&
            nextElement.type == "bpmn:ParallelGateway"
          ) {
            findPaths2(
              lastParallelGateway,
              [...currentPath],
              allPaths,
              [...currentPathByTask],
              allPathsByTasks,
              "parallel"
            );
          } else {
            findPaths2(
              nextElement,
              [...currentPath],
              allPaths,
              [...currentPathByTask],
              allPathsByTasks
            );
          }
        }
      }

      return [allPaths, allPathsByTasks];
    };

    const start = elementRegistry.get("StartEvent_1") as Element;

    console.log("Alle Pfade: ", findPaths1(start));

    //console.log("Alle Pfade2: ", findPaths2(start));

    // Manuell ParallelGateway wählen
    // const elementName = "Gateway_06lwiyz";
    // const element = elementRegistry.get(elementName);

    // console.log("Element:", element);
    // logBusinessObject(element);

    // const nextElement = element.outgoing[0];
    // logBusinessObject(nextElement);

    // const nextElement1 = nextElement.target;
    // logBusinessObject(nextElement1);

    //modeling.removeConnection(nextElement);
    //modeling.removeConnection(nextElement1);

    // console.log("BusinessObject of element:", element.businessObject);
  } catch (error) {
    console.error(error);
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
