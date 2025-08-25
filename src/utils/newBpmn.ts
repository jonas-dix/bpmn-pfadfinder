import ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type Modeler from "bpmn-js/lib/Modeler";
import type Modeling from "bpmn-js/lib/features/modeling/Modeling";
import type { Element, Parent } from "bpmn-js/lib/model/Types";
import type ElementFactory from "bpmn-js/lib/features/modeling/ElementFactory";

/**
 * Hängt eine TextAnnotation an das Start-Event mit der Zusammenfassung
 * aus Gateway-Name + gewähltem SequenceFlow.
 *
 * @param path IDs in Reihenfolge
 * @param modeler bpmn-js Modeler (für moddle + modeling)
 * @param elementRegistry bpmn-js ElementRegistry
 */
export function addSummaryAnnotationAtStart(
  path: string[],
  modeler: Modeler,
  modeling: Modeling,
  elementRegistry: ElementRegistry
) {
  const elementFactory = modeler.get("elementFactory") as ElementFactory;
  const lines: string[] = [];

  const startElement = elementRegistry.get(path[0]) as Element;
  if (!startElement) return;

  let gwNumber = 0;

  // Für jedes (a -> b) Paar: Wenn a ein Exclusive Gateway ist, hole den Flow a->b
  for (let i = 0; i < path.length - 1; i++) {
    const a = elementRegistry.get(path[i]) as Element;
    const b = elementRegistry.get(path[i + 1]) as Element;
    if (!a || !b) continue;

    const isExclusiveGateway = a.type === "bpmn:ExclusiveGateway";
    const hasSeveralOutgoings = a.outgoing.length > 1;

    if (!isExclusiveGateway || !hasSeveralOutgoings) continue;

    gwNumber++;

    const flow = a.outgoing.find((f) => f.target?.id === b.id);
    if (!flow) continue;
    console.log(a.outgoing);
    const outgoingIndex = a.outgoing.findIndex((f) => f.id === flow.id) + 1;
    const gwName =
      a.businessObject?.name?.trim() || `Exclusive Gateway ${gwNumber}`;
    const flowName =
      flow.businessObject?.name?.trim() || `Outgoing ${outgoingIndex}`;

    lines.push(`• ${gwName} → ${flowName}`);
  }

  if (!lines.length) return;

  const text = `Auswahl-Pfade:\n${lines.join("\n")}`;

  // Parent robust wählen: wenn Lane -> nimm deren Parent (meist Process)
  const parent =
    (startElement.parent?.type === "bpmn:Lane"
      ? startElement.parent.parent
      : startElement.parent) || (startElement as Parent);

  // Shape mit elementFactory erzeugen (kümmert sich um id/DI)
  const noteShape = elementFactory.createShape({ type: "bpmn:TextAnnotation" });

  // Text setzen NACH dem Create der Shape-BO
  noteShape.businessObject.text = text;

  // Platzieren
  const createdNote = modeling.createShape(
    noteShape,
    { x: (startElement as any).x - 100, y: (startElement as any).y },
    parent as Parent
  );

  // Assoziation herstellen
  modeling.connect(startElement, createdNote, { type: "bpmn:Association" });
}

export function reduceDiagramToPath(
  path: string[],
  elementRegistry: ElementRegistry,
  modeling: Modeling
) {
  const keep = new Set<string>();

  // Elemente aus dem Pfad behalten
  for (const id of path) {
    keep.add(id);
  }

  const allElements = elementRegistry.getAll() as Element[];

  // Relevante SequenceFlows behalten
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i],
      b = path[i + 1];
    const flow = allElements.find(
      (el: Element) =>
        el.type === "bpmn:SequenceFlow" &&
        el.businessObject?.sourceRef?.id === a &&
        el.businessObject?.targetRef?.id === b
    );
    if (flow) {
      keep.add(flow.id);
    }
  }

  // Labels der behaltenen Elemente ebenfalls behalten
  for (const id of Array.from(keep)) {
    const el = elementRegistry.get(id);
    if (el?.label?.id) {
      keep.add(el.label.id);
    }
  }

  // Wichtige Root-/Umgebungs-Elemente behalten
  const NEVER_REMOVE_TYPES = new Set([
    "bpmn:Process",
    "bpmn:Collaboration",
    "bpmn:Participant",
  ]);

  // Behalte nur TextAnnotations und deren Associations, wenn das verbundene Element erhalten bleibt
  const annotations = elementRegistry
    .getAll()
    .filter((el) => el.type === "bpmn:TextAnnotation");

  for (const annotation of annotations) {
    // Finde die zugehörige Association
    const associations = elementRegistry
      .getAll()
      .filter(
        (el) =>
          el.type === "bpmn:Association" &&
          el.target?.id === annotation.id &&
          keep.has(el.source?.id)
      );

    // Behalte Annotation und Association nur, wenn das verbundene Element (source) erhalten bleibt
    if (associations.length > 0) {
      keep.add(annotation.id);
      if (annotation.label?.id) {
        keep.add(annotation.label.id);
      }
      for (const assoc of associations) {
        keep.add(assoc.id);
        if (assoc.label?.id) {
          keep.add(assoc.label.id);
        }
      }
    }
  }

  // Alles andere entfernen
  const toRemove = allElements.filter((el: any) => {
    if (NEVER_REMOVE_TYPES.has(el.type)) return false;
    return !keep.has(el.id);
  });

  if (toRemove.length) {
    modeling.removeElements(toRemove);
  }
}

// const elementsToBeRemoved = elementRegistry.getAll().filter((el) => {
//   // bpmn:Process darf nie gelöscht werden
//   if (el.type === "bpmn:Process") return false;

//   // Falls ID im Pfad enthalten ist, behalten
//   if (path.includes(el.id)) return false;

//   // Für sequenceFlow prüfen, ob source enthalten ist und target darauf folgt
//   if (el.type === "bpmn:SequenceFlow") {
//     const { sourceRef, targetRef } = el.businessObject;
//     if (sourceRef && targetRef && path.includes(sourceRef.id)) {
//       if (
//         path.filter(
//           (id, index) =>
//             id === sourceRef.id && path[index + 1] === targetRef.id
//         ).length > 0
//       )
//         return false;
//     }
//   }

//   return true;
// });

// for (const el of elementsToBeRemoved) {
//   // Element aus Diagramm entfernen
//   modeling.removeElements([el as any]);
// }

// import { xml2js, js2xml } from "xml-js";
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
