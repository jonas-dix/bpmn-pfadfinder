import fs from "fs";
import path from "path";
import BpmnModdle from "bpmn-moddle";
import type {
  Gateway,
  SimpleElement,
  SimpleElementRegistry,
} from "@/types/bpmn";

const projectRoot = process.cwd();
const diagramsDir = path.resolve(projectRoot, "public/bpmn-codes/testing");

export async function loadTestDiagram(file: string): Promise<{
  startElement: SimpleElement;
  elementRegistry: SimpleElementRegistry;
}> {
  const xml = fs.readFileSync(path.resolve(diagramsDir, file), "utf-8");
  const moddle = new BpmnModdle();
  const { rootElement: definitions } = await moddle.fromXML(xml);
  const process = definitions.rootElements.find(
    (el: any) => el.$type === "bpmn:Process"
  );
  const startElement = process.flowElements.find(
    (el: any) => el.$type === "bpmn:StartEvent"
  );
  const elements = process.flowElements;

  // Füge fehlende Properties hinzu
  for (const el of elements) {
    el.type = el.$type; // simulate viewer-style .type
    el.businessObject = el; // simulate viewer-style .businessObject
  }
  const elementRegistry = {
    getAll: () => elements,
    get: (id: string) => elements.find((el: any) => el.id === id),
  };
  return { startElement, elementRegistry };
}
