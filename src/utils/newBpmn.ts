// import { xml2js, js2xml } from "xml-js";
import ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type Modeling from "bpmn-js/lib/features/modeling/Modeling";

export function reduceDiagramToPath(
  path: string[],
  elementRegistry: ElementRegistry,
  modeling: Modeling
) {
  const elementsToBeRemoved = elementRegistry.getAll().filter((el) => {
    // bpmn:Process darf nie gelöscht werden
    if (el.type === "bpmn:Process") return false;

    // Falls ID im Pfad enthalten ist, behalten
    if (path.includes(el.id)) return false;

    // Für sequenceFlow prüfen, ob source enthalten ist und target darauf folgt
    if (el.type === "bpmn:SequenceFlow") {
      const { sourceRef, targetRef } = el.businessObject;
      if (sourceRef && targetRef && path.includes(sourceRef.id)) {
        if (
          path.filter(
            (id, index) =>
              id === sourceRef.id && path[index + 1] === targetRef.id
          ).length > 0
        )
          return false;
      }
    }

    return true;
  });

  for (const el of elementsToBeRemoved) {
    // Element aus Diagramm entfernen
    modeling.removeElements([el as any]);
  }
}

// export function createMinimalBpmnXmlFromPath(
//   originalXml: string,
//   path: string[]
// ): string {
//   const xmlObj = xml2js(originalXml, { compact: false }) as any;

//   // Navigiere zur Prozessdefinition
//   const definitions = xmlObj.elements.find(
//     (el: any) => el.name === "bpmn:definitions"
//   );
//   if (!definitions)
//     throw new Error("Kein <bpmn:definitions> Element gefunden.");

//   const process = definitions.elements.find(
//     (el: any) => el.name === "bpmn:process"
//   );
//   if (!process) throw new Error("Kein <bpmn:process> Element gefunden.");

//   const allElements = process.elements || [];

//   // Filtere nur die Elemente, die im Pfad vorkommen + Sequenzflüsse
//   const filteredElements = allElements.filter((el: any) => {
//     if (!el.attributes || !el.attributes.id) return false;
//     const id = el.attributes.id;
//     if (path.includes(id)) return true;

//     // Behalte auch relevante SequenceFlows
//     if (el.name === "bpmn:sequenceFlow") {
//       const { sourceRef, targetRef } = el.attributes;
//       return path.includes(sourceRef) && path.includes(targetRef);
//     }

//     return false;
//   });

//   // Neue Prozessdefinition mit nur gefilterten Elementen
//   process.elements = filteredElements;

//   // Konvertiere zurück zu XML
//   const newXml = js2xml(xmlObj, { compact: false, spaces: 2 });
//   return newXml;
// }
