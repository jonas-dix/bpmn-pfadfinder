import { realizePathCombination } from "@/utils/pathAnalysis";
import type {
  Gateway,
  DeadlockPath,
  SimpleElementRegistry,
} from "@/types/bpmn";

/**
 * Aus dem Mapping werden die jeweils zugehörigen Pfade verbunden.
 * Ist in einem Merge ein deadlockPath vorhanden, brechen alle Pfade des Merges ab dem breakupElement ab.
 * @param mapping
 * @param deadlockPaths
 * @param allPaths
 */
export const createMergedPaths = function (
  mapping: number[][],
  allRawPaths: string[][],
  deadlockPaths: DeadlockPath[]
): string[][] {
  const allMergedPaths: string[][] = [];

  for (const pathCombination of mapping) {
    allMergedPaths.push(
      realizePathCombination(pathCombination, allRawPaths, deadlockPaths)
    );
  }
  return allMergedPaths;
};

/**
 * Erzeugt Pfade, die leichter zu lesen sind.
 * @param path
 * @param elementRegistry
 */
export const nicePath = function (
  path: string[],
  gateways: Gateway[],
  elementRegistry: SimpleElementRegistry
): string[] {
  const nicePath: string[] = [];

  for (const id of path) {
    const element = elementRegistry.get(id);

    if (element?.type === "bpmn:Task") {
      nicePath.push(`Task: ${element.businessObject.name}`);
    } else if (element?.type?.includes("Gateway")) {
      const gateway = gateways.find((gw) => gw.id === id);
      if (gateway)
        nicePath.push(
          `Gateway (${gateway.id}, ${gateway.type}, ${gateway.direction}, ${
            gateway.outgoing > gateway.incoming
              ? gateway.outgoing
              : gateway.incoming
          })`
        );
      else nicePath.push(id);
    } else if (element?.type === "bpmn:EndEvent") {
      nicePath.push(`End ${element.id}`);
    } else if (element?.type === "bpmn:StartEvent") {
      nicePath.push(`Start ${element.id}`);
    } else nicePath.push(id);
  }
  return nicePath;
};

/**
 * Erzeugt eine Liste von Pfaden, die leichter zu lesen ist.
 * @param pathList
 * @param gateways
 * @param elementRegistry
 */
export const nicePathList = function (
  pathList: string[][],
  gateways: Gateway[],
  elementRegistry: SimpleElementRegistry
): string[][] {
  const niceList: string[][] = [];

  for (const path of pathList) {
    niceList.push(nicePath(path, gateways, elementRegistry));
  }
  return niceList;
};
