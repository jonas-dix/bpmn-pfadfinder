import fs from "fs";
import path from "path";
import BpmnModdle from "bpmn-moddle";
import type { SimpleElement, SimpleElementRegistry } from "@/types/bpmn";

const projectRoot = process.cwd();
const diagramsDir = path.resolve(projectRoot, "public/bpmn-codes/testing");

export async function loadTestDiagram(file: string): Promise<{
  startElements: SimpleElement[];
  elementRegistry: SimpleElementRegistry;
}> {
  const xml = fs.readFileSync(path.resolve(diagramsDir, file), "utf-8");
  const moddle = new BpmnModdle();
  const { rootElement: definitions } = await moddle.fromXML(xml);
  const process = definitions.rootElements.find(
    (el: any) => el.$type === "bpmn:Process"
  );
  const elements = process.flowElements;

  // Füge fehlende Properties hinzu
  for (const el of elements) {
    el.type = el.$type; // simulate viewer-style .type
    el.businessObject = el; // simulate viewer-style .businessObject
  }

  const simpleElements: SimpleElement[] = elements as SimpleElement[];

  const startElements = simpleElements.filter(
    (el: SimpleElement) => el.type === "bpmn:StartEvent"
  );

  console.log(startElements);

  const elementRegistry = {
    getAll: () => [...simpleElements],
    get: (id: string) =>
      simpleElements.find((el: SimpleElement) => el.id === id),
  };
  return { startElements, elementRegistry };
}
