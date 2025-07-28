import type {
  Gateway,
  DeadlockPath,
  SimpleElementRegistry,
} from "@/types/bpmn";

/**
 * Ein Pfad wird gekürzt, sodass er nur zum ersten Element in breakupElements läuft.
 * @param path
 * @param breakupElements
 */
const cutPath = function (path: string[], breakupElements: string[]) {
  if (breakupElements.length === 0) return path;

  const cutPath: string[] = [];
  for (const element of path) {
    cutPath.push(element);
    if (breakupElements.includes(element)) break;
  }
  return cutPath;
};

/**
 * Aus dem Mapping werden die jeweils zugehörigen Pfade verbunden.
 * Ist in einem Merge ein deadlockPath vorhanden, brechen alle Pfade des Merges ab dem breakupElement ab.
 * @param mapping
 * @param deadlockPaths
 * @param allPaths
 */

export const createMergedPaths = function (
  mapping: number[][],
  deadlockPaths: DeadlockPath[],
  allPaths: string[][]
): string[][] {
  const MergedPaths: string[][] = [];

  for (const comb of mapping) {
    const mergedPath: string[] = [];
    const breakupElements: string[] = [];

    for (const i of comb) {
      const deadlockPath = deadlockPaths.find((dp) => dp.pathIndex === i);
      if (deadlockPath) breakupElements.push(deadlockPath.breakup);
    }
    for (const i of comb) {
      mergedPath.push(...cutPath(allPaths[i], breakupElements));
    }
    MergedPaths.push(mergedPath);
  }
  return MergedPaths;
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
          `Gateway (${gateway.direction}, ${gateway.type}): ${gateway.id}`
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
