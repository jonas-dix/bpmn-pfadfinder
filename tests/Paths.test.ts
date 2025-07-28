import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

import { loadTestDiagram } from "./testSetup"; // siehe vorheriger Beitrag
import {
  findRawPaths,
  linkGateways,
  mergePaths,
} from "../src/utils/pathAnalysis";

const projectRoot = process.cwd();
const diagramsDir = path.resolve(projectRoot, "public/bpmn-codes/testing");

const expectedCases: {
  file: string;
  numberRawPaths: number;
  numberMergedPaths: number;
}[] = JSON.parse(
  fs.readFileSync(path.resolve(diagramsDir, "expected.json"), "utf-8")
);

describe("findRawPaths mit moddle", () => {
  it.each(expectedCases)(
    "Betrachte Pfadanalyse von $file",
    async ({ file, numberRawPaths, numberMergedPaths }) => {
      const { startElement, elementRegistry } = await loadTestDiagram(file);
      const { allRawPaths, allGateways } = findRawPaths(
        startElement,
        elementRegistry
      );
      expect(allRawPaths.length).toBe(numberRawPaths);

      linkGateways(allGateways, allRawPaths);
      const mapping = mergePaths(allRawPaths, allGateways).mapping;
      expect(mapping.length).toBe(numberMergedPaths);
    }
  );
});

// Gateways testen
// Error soll kommen, testen

// describe("findRawPaths mit moddle", () => {
//   it.each(expectedCases)(
//     "korrekte Anzahl Pfade für $file",
//     async ({ file, numberRawPaths }) => {
//       const xml = fs.readFileSync(path.resolve(diagramsDir, file), "utf-8");
//       const moddle = new BpmnModdle();
//       const { rootElement: definitions } = await moddle.fromXML(xml);
//       const startingElement = getStartingElement(definitions);
//       const elementRegistry = createDummyElementRegistry(definitions);

//       const allPaths = findRawPaths(startingElement, elementRegistry).allPaths;
//       expect(allPaths.length).toBe(numberRawPaths);
//     }
//   );
// });

// function getStartingElement(definitions: any): any {
//   const process = definitions.rootElements.find(
//     (el: any) => el.$type === "bpmn:Process"
//   );
//   return process.flowElements.find((el: any) => el.$type === "bpmn:StartEvent");
// }

// function createDummyElementRegistry(definitions: any) {
//   const process = definitions.rootElements.find(
//     (el: any) => el.$type === "bpmn:Process"
//   );
//   const elements = process.flowElements;
//   // Füge fehlende Properties hinzu
//   for (const el of elements) {
//     el.type = el.$type; // simulate viewer-style .type
//     el.businessObject = el; // simulate viewer-style .businessObject
//   }
//   return {
//     getAll: () => elements,
//     get: (id: string) => elements.find((el: any) => el.id === id),
//   };
// }

// import { fileURLToPath } from "url";
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const xml = fs.readFileSync(path.resolve(diagramsDir, file), "utf-8");
// const moddle = new BpmnModdle();
// const { rootElement: definitions } = await moddle.fromXML(xml);
