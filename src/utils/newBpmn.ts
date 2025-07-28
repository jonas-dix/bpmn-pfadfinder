// utils/bpmnExport.ts
import { xml2js, js2xml } from "xml-js";

export function createMinimalBpmnXmlFromPath(
  originalXml: string,
  path: string[]
): string {
  const xmlObj = xml2js(originalXml, { compact: false }) as any;

  // Navigiere zur Prozessdefinition
  const definitions = xmlObj.elements.find(
    (el: any) => el.name === "bpmn:definitions"
  );
  if (!definitions)
    throw new Error("Kein <bpmn:definitions> Element gefunden.");

  const process = definitions.elements.find(
    (el: any) => el.name === "bpmn:process"
  );
  if (!process) throw new Error("Kein <bpmn:process> Element gefunden.");

  const allElements = process.elements || [];

  // Filtere nur die Elemente, die im Pfad vorkommen + Sequenzflüsse
  const filteredElements = allElements.filter((el: any) => {
    if (!el.attributes || !el.attributes.id) return false;
    const id = el.attributes.id;
    if (path.includes(id)) return true;

    // Behalte auch relevante SequenceFlows
    if (el.name === "bpmn:sequenceFlow") {
      const { sourceRef, targetRef } = el.attributes;
      return path.includes(sourceRef) && path.includes(targetRef);
    }

    return false;
  });

  // Neue Prozessdefinition mit nur gefilterten Elementen
  process.elements = filteredElements;

  // Konvertiere zurück zu XML
  const newXml = js2xml(xmlObj, { compact: false, spaces: 2 });
  return newXml;
}
