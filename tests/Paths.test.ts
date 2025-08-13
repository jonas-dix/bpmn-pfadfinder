import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";

import type {
  DeadlockPath,
  Gateway,
  SimpleElement,
  SimpleElementRegistry,
} from "@/types/bpmn";
import { loadTestDiagram } from "./testSetup"; // siehe vorheriger Beitrag
import {
  findStartElements,
  findRawPaths,
  linkGateways,
  mergePaths,
} from "@/utils/pathAnalysis";
import { createMergedPaths, nicePath } from "@/utils/formatting";

import type { ExpectedCase } from "@/types/testing";

const projectRoot = process.cwd();

const expectedCases: ExpectedCase[] = JSON.parse(
  fs.readFileSync(path.resolve(projectRoot, "tests/expected.json"), "utf-8")
);

describe("Testen der Pfadanalyse", () => {
  for (const testCase of expectedCases) {
    const { file } = testCase;
    describe(`Testdiagramm: ${file}`, () => {
      if (testCase.shouldFail) {
        it("wirft einen Fehler, da das Diagramm falsch ist.", async () => {
          await expect(async () => {
            const { startElements, elementRegistry } = await loadTestDiagram(
              file
            );
            const { allRawPaths, allGateways } = findRawPaths(
              elementRegistry,
              startElements
            );
            linkGateways(allGateways, allRawPaths, startElements);
          }).rejects.toThrow();
        });

        return;
      }

      const { numberRawPaths, numberMergedPaths } = testCase;

      let startElements: SimpleElement[];
      let elementRegistry: SimpleElementRegistry;
      let allRawPaths: string[][] = [];
      let allGateways: Gateway[] = [];
      let mapping: number[][] = [];
      let deadlockPaths: DeadlockPath[] = [];
      let mergedPaths: string[][] = [];

      beforeAll(async () => {
        ({ startElements, elementRegistry } = await loadTestDiagram(file));
        ({ allRawPaths, allGateways } = findRawPaths(
          elementRegistry,
          startElements
        ));
        linkGateways(allGateways, allRawPaths, startElements);
        ({ mapping, deadlockPaths } = mergePaths(allRawPaths, allGateways));
        mergedPaths = createMergedPaths(mapping, allRawPaths, deadlockPaths);
      });

      it("liefert die erwartete Anzahl an raw paths.", () => {
        expect(allRawPaths.length).toBe(numberRawPaths);
      });

      it("verknüpft Gateways korrekt.", () => {
        for (const gateway of allGateways.filter(
          (gw) => gw.direction === "split"
        )) {
          const counterpart = allGateways.find(
            (gw) => gw.id === gateway.counterpart
          );
          if (counterpart) {
            expect(gateway.type).toBe(counterpart.type);
            expect(gateway.outgoing).toBe(counterpart.incoming);
          }
        }
      });

      it("liefert die erwartete Anzahl an merged paths.", () => {
        expect(mapping.length).toBe(numberMergedPaths);
      });

      it("Kombination enthält mehr als einen Pfad, wenn parallel gateway beteiligt ist.", () => {
        for (let i = 0; i < mapping.length; i++) {
          const comb = mapping[i];
          const path = mergedPaths[i];
          if (
            allGateways.some(
              (gw) => gw.type === "parallel" && path.includes(gw.id)
            )
          ) {
            expect(comb.length).toBeGreaterThan(1);
          }
        }
      });

      it("Pfad stoppt am deadlockpath, sofern vorhanden.", () => {
        for (const deadlockPath of deadlockPaths) {
          for (let i = 0; i < mapping.length; i++) {
            const comb = mapping[i];
            const path = nicePath(mergedPaths[i], allGateways, elementRegistry);
            if (
              comb.includes(deadlockPath.pathIndex) &&
              path.includes(deadlockPath.breakup)
            ) {
              const count = path.filter((el) =>
                el.includes("End Event")
              ).length;
              expect(count).toBeLessThan(comb.length);
            }
          }
        }
      });
    });
  }
});

// describe("Pfadanalyse pro Datei mit moddle", () => {
//   it.each(expectedCases)(
//     "Teste die Pfadanalyse von $file",
//     async (testCase) => {
//       const { file } = testCase;
//       if (testCase.shouldFail) {
//         console.log("Der Algorithmus soll einen Fehler werfen.");
//         const { startElement, elementRegistry } = await loadTestDiagram(file);
//         await expect(async () => {
//           const { allRawPaths, allGateways } = findRawPaths(
//             startElement,
//             elementRegistry
//           );
//           linkGateways(allGateways, allRawPaths);
//         }).rejects.toThrow();
//       } else {
//         // Teste, ob die richtige Anzahl an raw paths ermittelt wurde.
//         const { numberRawPaths, numberMergedPaths } = testCase;
//         const { startElement, elementRegistry } = await loadTestDiagram(file);
//         const { allRawPaths, allGateways } = findRawPaths(
//           startElement,
//           elementRegistry
//         );
//         expect(allRawPaths.length).toBe(numberRawPaths);

//         // Teste, ob die Gateways korrekt verknüpft wurden.
//         linkGateways(allGateways, allRawPaths);
//         for (const gateway of allGateways.filter(
//           (gw) => gw.direction === "split"
//         )) {
//           const counterpart = allGateways.find(
//             (gw) => gw.id === gateway.counterpart
//           );
//           if (counterpart) {
//             expect(gateway.type).toBe(counterpart.type);
//             expect(gateway.outgoing).toBe(counterpart.incoming);
//           }
//         }

//         // Teste, ob die richtige Anzahl an merged paths ermittelt wurde.
//         const { mapping, deadlockPaths } = mergePaths(allRawPaths, allGateways);
//         expect(mapping.length).toBe(numberMergedPaths);

//         // Teste, ob ein merged path der ein parallel gateway beinhaltet, wirklich aus mehreren Pfaden besteht.
//         const mergedPaths = createMergedPaths(
//           mapping,
//           deadlockPaths,
//           allRawPaths
//         );
//         for (let i = 0; i < mapping.length; i++) {
//           const comb = mapping[i];
//           const path = mergedPaths[i];
//           if (
//             allGateways.some(
//               (gw) => gw.type === "parallel" && path.includes(gw.id)
//             )
//           ) {
//             expect(comb.length).toBeGreaterThan(1);
//           }
//         }

//         // Teste, ob die entsprechenden Merges wirklich am Deadlockpath stoppen.
//         for (const deadlockPath of deadlockPaths) {
//           for (let i = 0; i < mapping.length; i++) {
//             const comb = mapping[i];
//             const path = nicePath(mergedPaths[i], allGateways, elementRegistry);
//             if (
//               comb.includes(deadlockPath.pathIndex) &&
//               path.includes(deadlockPath.breakup)
//             ) {
//               const count = path.filter((el) =>
//                 el.includes("End Event")
//               ).length;
//               expect(count).toBeLessThan(comb.length);
//             }
//           }
//         }
//       }
//     }
//   );
// });

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
