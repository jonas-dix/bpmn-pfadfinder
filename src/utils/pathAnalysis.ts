import type { Element } from "diagram-js/lib/model";
import type { SimpleElement, SimpleElementRegistry } from "../types/bpmn";
import type { Gateway, DeadlockPath } from "@/types/bpmn";

/**
 * Berechnet alle Pfade, ausgehend von currentElement mit Tiefensuche (DFS).
 * Dabei werden alle Gateways als Exclusive Gateways aufgefasst.
 * @param startElement
 * @param elementRegistry
 */
export const findRawPaths = function (
  startElement: SimpleElement,
  elementRegistry: SimpleElementRegistry
): {
  allRawPaths: string[][];
  allGateways: Gateway[];
} {
  const allRawPaths: string[][] = [];
  const allGateways: Gateway[] = [];

  const dfs = (currentElement: SimpleElement, currentPath: string[] = []) => {
    currentPath.push(currentElement.id);

    if (currentElement.type == "bpmn:EndEvent") {
      allRawPaths.push([...currentPath]); // Speicher Kopie des Arrays
      return;
    }

    let type: string | undefined;
    if (currentElement.type === "bpmn:ExclusiveGateway") {
      type = "exclusive";
    } else if (currentElement.type === "bpmn:ParallelGateway") {
      type = "parallel";
    } else if (currentElement.type === "bpmn:InclusiveGateway") {
      type = "inclusive";
    }

    // Komischerweise: Wenn ich das Diagramm auf der Website manuell lade, muss ich businessObject benutzen
    // (sonst outgoing ohne informationen) und nur per ID auf nextElement zugreifen.
    // flow.target ist nicht stabil, bei externem XML-import.
    // übrigens bei moddle gibt es businessObject nicht, dort würde man currentElement.outgoing verwenden
    const outgoing: SimpleElement[] =
      currentElement.businessObject?.outgoing || [];
    const incoming: SimpleElement[] =
      currentElement.businessObject?.incoming || [];
    const direction = outgoing.length > incoming.length ? "split" : "join";

    if (type && !allGateways.some((pg) => pg.id === currentElement.id)) {
      allGateways.push({
        id: currentElement.id,
        type: type,
        direction: direction,
        incoming: incoming.length,
        outgoing: outgoing.length,
      });
    }

    for (const flow of outgoing) {
      // const nextElement = flow.target;
      const targetId = flow.targetRef?.id;
      if (!targetId) continue;
      const nextElement = elementRegistry.get(targetId);
      if (nextElement) {
        dfs(nextElement, [...currentPath]);
      }
    }
  };

  dfs(startElement);

  if (allRawPaths.length === 0) {
    throw new Error("Die Funktion findPaths hat einen leeren Output ergeben.");
  }

  return { allRawPaths, allGateways };
};

/**
 * Ergänzt die Gateways mit der Eigenschaft counterpart, welche die ID des zugehörigen Split/Join-Gateway angibt.
 * @param gateways
 * @param allRawPaths
 */
export const linkGateways = function (
  gateways: Gateway[],
  allRawPaths: string[][],
  verbose: boolean[] = [false, false]
) {
  for (const joinGateway of gateways
    .filter((gw) => gw.direction === "join")
    .slice()
    .reverse()) {
    outer: for (const splitGateway of gateways
      .filter((gw) => gw.direction === "split")
      .slice()
      .reverse()) {
      for (const path of allRawPaths) {
        if (path.includes(joinGateway.id)) {
          if (
            path.includes(splitGateway.id) &&
            path.indexOf(splitGateway.id) > path.indexOf(joinGateway.id)
          )
            continue outer;
          if (!path.includes(splitGateway.id)) {
            continue outer;
          }
        }
      }
      // Split Gateway wird zugewiesen, wenn alle Pfade die das Join Gateway durchlaufen, davor durch dieses Split Gateway durchlaufen sind
      joinGateway.counterpart = splitGateway.id;
      splitGateway.counterpart = joinGateway.id;
      if (true)
        console.log(
          `Join Gateway ${joinGateway.id} und Split Gateway ${splitGateway.id} gehören zusammen.`
        );
      break;
    }
  }

  const joinGatewayCounterparts = new Set<String>([]);
  let joinGatewayCount = 0;
  for (const joinGateway of gateways.filter((gw) => gw.direction === "join")) {
    if (!joinGateway.counterpart) {
      console.error(
        `Join Gateway ${joinGateway.id} konnte kein Counterpart zugewiesen werden.`
      );
      throw new Error("Gateways konnten einander nicht zugewiesen werden.");
    }
    joinGatewayCounterparts.add(joinGateway.counterpart);
    joinGatewayCount++;
  }
  if (joinGatewayCounterparts.size < joinGatewayCount) {
    console.error(
      "Zwei Join-Gateways wurde dasselbe Split-Gateway zugeordnet."
    );
    throw new Error("Gateways konnten einander nicht zugewiesen werden.");
  }
};

/**
 * Prüft ob zwei Listen bis zu einem Index identisch sind und ein Index danach unterschiedlich sind.
 * Zusätzlich wird geprüft, ob sie am Index danach auch unterschiedlich zu anderen Werten sind.
 * @param a
 * @param b
 * @param endIndex
 * @param differentFrom
 */
const sameStartThenDifferent = function (
  a: string[],
  b: string[],
  endIndex: number,
  differentFrom: string[] = []
): boolean {
  return (
    !(a[endIndex + 1] === b[endIndex + 1]) &&
    a.slice(0, endIndex + 1).every((val, i) => val === b[i]) &&
    !differentFrom.includes(a[endIndex + 1]) &&
    !differentFrom.includes(b[endIndex + 1])
  );
};

/**
 * Wenn Liste a ab einem startIndex den gleichen Wert wie b aufweist und beide Listen ab da gleich enden, wird true ausgegeben.
 * Falls sie ab dem startIndex überhaupt keinen gleichen Wert aufweisen, wird ebenfalls true ausgegeben.
 * @param a
 * @param b
 * @param startIndex
 */
const sameEndingIndex = function (
  a: string[],
  b: string[],
  startIndex: number
): boolean {
  for (let i = startIndex; i < a.length; i++) {
    if (b.includes(a[i])) {
      const indexB = b.indexOf(a[i]);
      if (
        a.slice(i).length === b.slice(indexB).length &&
        a.slice(i).every((val, j) => val === b.slice(indexB)[j])
      ) {
        return true;
      } else {
        return false;
      }
    }
  }
  return true;
};

/**
 * Führt entsprechende Pfade an einem Gateway (parallel oder inclusive) zusammen.
 * Gateway.outgoing viele Pfade werden zusammengefügt.
 * Pfade werden gemergt, wenn sie das Gateway durchlaufen, dieselbe Vorgeschichte haben und, wenn sie an einem späteren Zeitpunkt sich überschneiden, auch
 * zusammen bleiben, bzw., wenn sie vollkommen getrennt bleiben.
 * In letzterem Fall wird der Pfad, der getrennt bleibt, also nicht mehr durch das Join Gateway läuft, als DeadlockPath aufgefasst.
 * Das bedeutet, dass die Pfade alle nur bis zum Deadlockelement laufen.
 * @param allRawPaths
 * @param gateway
 * @param verbose
 */
const mergePathsAtGateway = function (
  allRawPaths: string[][],
  gateway: Gateway,
  verbose: boolean[] = [false, false]
): [number[][], DeadlockPath[]] | undefined {
  const pathCombinations: number[][][] = [];
  const deadlockPaths: DeadlockPath[] = [];

  const n = allRawPaths.length;

  if (verbose[0])
    console.log(`Betrachte Gateway ${gateway.id} vom Typ ${gateway.type}`);
  // let vecOutgoings: number[] = [];
  // if (gateway.type === "parallel") {
  //   vecOutgoings = [gateway.outgoing];
  // } else {
  //   if (gateway.type === "inclusive") {
  //     vecOutgoings = Array.from(
  //       { length: gateway.outgoing },
  //       (_, i) => i + 1 //gateway.outgoing - i
  //     );
  //   }
  // }

  // Zur Überprüfung, dass alle Pfade behandelt wurden
  const pathProcessed: boolean[] = Array(n).fill(false);

  let inclusiveCases: number;
  if (gateway.type === "inclusive") inclusiveCases = gateway.outgoing;
  else inclusiveCases = 1;

  for (let k = 1; k < inclusiveCases + 1; k++) {
    let numOutgoings: number;
    if (gateway.type === "inclusive") numOutgoings = k;
    else numOutgoings = gateway.outgoing;
    const pathCombinationsK: number[][] = [];
    if (verbose[0]) console.log("Zahl der outgoings:", numOutgoings);
    for (let i = 0; i < n; i++) {
      const path = allRawPaths[i];
      if (verbose[0]) console.log("Betrachte Pfad", i + 1);
      if (!path.includes(gateway.id)) {
        pathCombinationsK.push([i]);
        pathProcessed[i] = true;
        if (verbose[0])
          console.log(`Pfad ${i + 1} passierte dieses Gateway nicht.`);
        continue;
      }
      if (numOutgoings == 1) {
        pathCombinationsK.push([i]);
        pathProcessed[i] = true;
        if (verbose[0])
          console.log(`Pfad ${i + 1} wird als einzelner Merge hinzugefügt.`);
        continue;
      }
      const gatewayIndex = path.indexOf(gateway.id);

      /**
       * Versucht, Pfad i, der durch gateway zum Zeitpunkt gatewayIndex geht,
       * mit numOutgoings vielen Pfaden j>i zu mergen.
       * Dabei werden alle Pfadkombinationen betrachtet und diejenigen als Liste von Indizes zu pathcombinations hinzugefügt, die die Merging-Bedingungen erfüllen.
       * pathProcessed und deadlockPaths werden dabei aktualisiert.
       * @param outgoingsUsed
       * @param pathsUsed
       */
      const mergeNewPath = (
        pathsUsed = [i],
        outgoingsUsed = [path[gatewayIndex]]
      ): void => {
        // Iteriere über alle Pfad j>i, die nach dem letzten gemergten Pfad kommen.
        for (let j = i + 1; j < n; j++) {
          const updatedPathsUsed = [...pathsUsed, j];
          if (j > pathsUsed[pathsUsed.length - 1]) {
            if (verbose[0])
              console.log(`Überprüfe ob Pfad ${j + 1} gemergt werden kann.`);
            const mergingPath = allRawPaths[j];
            if (
              sameStartThenDifferent(
                path,
                mergingPath,
                gatewayIndex,
                outgoingsUsed
              ) &&
              sameEndingIndex(path, mergingPath, gatewayIndex + 1)
            ) {
              // Wenn Pfad nicht zum join gateway zurückkommt, bleibt der ganze Prozess dort stehen
              if (
                gateway.counterpart &&
                !deadlockPaths.some((dp) => dp.pathIndex === j) &&
                !mergingPath.includes(gateway.counterpart)
              ) {
                if (verbose[1]) console.log("Deadlock Pfad gefunden!");
                const deadlockPath = {
                  pathIndex: j,
                  breakup: gateway.counterpart,
                };
                deadlockPaths.push(deadlockPath);
              }
              if (verbose[0]) console.log("Merging erfolgreich.");
              // Prüfe, ob genug Pfade zusammengefasst wurden.
              if (updatedPathsUsed.length === numOutgoings) {
                if (verbose[0]) {
                  console.log(
                    "Pfade zusammengefügt:",
                    updatedPathsUsed.map((n) => n + 1)
                  );
                }
                pathCombinationsK.push(updatedPathsUsed);
                for (const k of updatedPathsUsed) pathProcessed[k] = true;
              } else {
                // Speichere die benutzten Outgoings für das nächste Mergen
                const updatedOutgoingsUsed = [
                  ...outgoingsUsed,
                  mergingPath[gatewayIndex + 1],
                ];
                // Es wird der nächste Pfad gesucht, der dazu gemergt werden kann.
                mergeNewPath(updatedPathsUsed, updatedOutgoingsUsed);
              }
            }
          }
        }
      };

      if (verbose[0]) console.log("Funktion mergeNewPath wird gestartet.");
      mergeNewPath();
      if (verbose[0]) console.log("Funktion mergeNewPath wurde beendet.");
    }
    pathCombinations.push(pathCombinationsK);
  }

  if (pathProcessed.includes(false)) {
    for (let i = 0; i < pathProcessed.length; i++) {
      if (pathProcessed[i] == false) {
        throw new Error(`Der Pfad ${i + 1} ist verloren gegangen!`);
      }
    }
    alert("Fehler beim Analysieren der BPMN-Datei.");
  }

  const pathCombinationsOutput = pathCombinations.flatMap((x) => x);
  // .sort((x, y) => {
  //   for (let i = 0; i < Math.min(x.length, y.length); i++) {
  //     if (x[i] !== y[i]) {
  //       return x[i] - y[i];
  //     }
  //   }
  //   return 0;
  // });

  return [pathCombinationsOutput, deadlockPaths];
};

/**
 * Führt zwei Listen von Listen zusammen.
 * Jedes a aus first wird mit entsprechenden b aus second zusammengefügt, sodass jeder Index aus a in einem b
 * vertreten ist.
 * Die resultierende Liste wird ohne Duplikate ausgegeben und so, dass jedes Listenelement sortiert ist
 * und kein Wert doppelt auftritt.
 * @param first
 * @param second
 */
const mergeMatchingLists = function (
  first: number[][],
  second: number[][],
  allPaths: string[][]
): number[][] {
  let mapping: number[][] = [];
  let count = 0;

  for (const a of first) {
    let i = 0;
    let mergingSuccesful = false;
    /**
     * Fasst Liste a mit Listen aus second zusammen.
     * Für jeden Index von a wird eine Liste aus second gesucht, die diesen Index enthält.
     * Diese Liste wird dann zu a hinzugefügt.
     * Alle Kombinationen werden gesucht.
     * @param index
     * @param merged
     * @param count
     */
    const findb = (index = i, merged = new Set(a)) => {
      for (let j = 0; j < second.length; j++) {
        const b = second[j];
        const updatedMerged = new Set(merged);
        if (b.includes(a[index])) {
          b.forEach((el) => updatedMerged.add(el));
          if (index < a.length - 1) {
            findb(index + 1, updatedMerged);
          } else {
            const checkAddOutput = checkAdd(
              Array.from(updatedMerged).sort((x, y) => x - y),
              mapping,
              allPaths
            );
            mapping = checkAddOutput[0];
            mergingSuccesful = true;
            if (checkAddOutput[1]) count++;

            // if (inclusiveOutgoings && count === 2 ** inclusiveOutgoings - 1) {
            //   mappingBlock.sort((a, b) => {
            //     if (a.length < b.length) return -1;
            //     if (b.length < a.length) return 1;
            //     for (let i = 0; i < Math.min(a.length, b.length); i++) {
            //       if (a[i] !== b[i]) {
            //         return a[i] - b[i];
            //       }
            //     }
            //     return 0;
            //   });

            //   console.log("!!!", mappingBlock);
            //   mapping.push(...mappingBlock);
            //   mappingBlock = [];
            //   count = 0;
          }
        }
      }
    };

    findb();
    if (mergingSuccesful == false)
      throw new Error(
        "Im Mapping des aktuellen Gateways ist ein Pfadindex nicht vertreten."
      );
  }

  return mapping;
};

const checkAdd = function (
  candidate: number[],
  mapping: number[][],
  allPaths: string[][]
): [number[][], boolean] {
  if (
    mapping.some(
      (list) => JSON.stringify(list) === JSON.stringify(candidate)
    ) ||
    mapping.some((list) => JSON.stringify(list) === JSON.stringify(candidate))
  )
    return [mapping, false];
  const a = new Set(candidate.flatMap((index) => allPaths[index]));
  for (let i = 0; i < mapping.length; i++) {
    const b = new Set(mapping[i].flatMap((index) => allPaths[index]));
    const aContainsB = [...b].every((el) => a.has(el));
    const bContainsA = [...a].every((el) => b.has(el));
    if (aContainsB && bContainsA) {
      const merged = Array.from(new Set([...candidate, ...mapping[i]])).sort(
        (x, y) => x - y
      );
      mapping[i] = merged;
      return [mapping, false];
    }
  }
  mapping.push(candidate);
  return [mapping, true];
};

// not needed!!!
const simplifyMapping = function (
  mapping: number[][],
  allPaths: string[][]
): number[][] {
  let changed = true;
  let simplifiedMapping = mapping.map((a) => [...a]);

  while (changed) {
    changed = false;
    const next: number[][] = [];
    const added = Array(simplifiedMapping.length).fill(false);

    for (let i = 0; i < simplifiedMapping.length; i++) {
      if (added[i]) continue;
      const a = new Set(
        simplifiedMapping[i].flatMap((index) => allPaths[index])
      );
      for (let j = i + 1; j < simplifiedMapping.length; j++) {
        if (added[j]) continue;
        const b = new Set(
          simplifiedMapping[j].flatMap((index) => allPaths[index])
        );
        const aContainsB = [...b].every((el) => a.has(el));
        const bContainsA = [...a].every((el) => b.has(el));
        if (aContainsB && bContainsA) {
          const merged = Array.from(
            new Set([...simplifiedMapping[i], ...simplifiedMapping[j]])
          ).sort((x, y) => x - y);
          next.push(merged);
          added[i] = true;
          added[j] = true;
          changed = true;
          break;
        }
      }
      if (!added[i]) {
        next.push(simplifiedMapping[i]);
      }
    }
    simplifiedMapping = next.map((a) => [...a]);
  }
  return simplifiedMapping;
};

function isSubset(a: number[], b: number[]): boolean {
  return a.every((v) => b.includes(v));
}

/**
 * Führt Pfade zusammen.
 * Benutzt mergePathsAtGateway an jedem Gateway und mergeMatchingLists um Gateway-Kombinationen zusammenzuführen.
 * @param allRawPaths
 * @param gateways
 * @param verbose bei true werden die wichtigen Schritte in der Konsole ausgegeben.
 */
export const mergePaths = function (
  allRawPaths: string[][],
  gateways: Gateway[],
  verbose: boolean[] = [false, false]
): { mapping: number[][]; deadlockPaths: DeadlockPath[] } {
  const n = allRawPaths.length;

  let mapping: number[][] | null = null;
  const deadlockPaths: DeadlockPath[] = [];

  for (const gateway of gateways.filter(
    (gw) => gw.type !== "exclusive" && gw.direction == "split"
  )) {
    const mergedPathsAtGateway = mergePathsAtGateway(
      allRawPaths,
      gateway,
      verbose
    );
    if (!mergedPathsAtGateway) continue;
    const [mappingAtGateway, deadlockPathsAtGateway] = mergedPathsAtGateway;
    deadlockPaths.push(...deadlockPathsAtGateway);

    if (verbose[1]) {
      console.log(
        `Zusammengefasste Pfade an Gateway (${gateway.id}, ${gateway.type}, ${gateway.outgoing}):`,
        mappingAtGateway.map((arr) => arr.map((n) => n + 1))
      );
      if (mapping)
        console.log(
          "Zusammengefasste Pfade der vorherigen Gateways:",
          mapping.map((arr) => arr.map((n) => n + 1))
        );
    }

    if (mapping) {
      mapping = mergeMatchingLists([...mapping], mappingAtGateway, allRawPaths);
    } else mapping = mappingAtGateway;
    if (verbose[1])
      console.log(
        "Resultierende Pfade:",
        mapping.map((arr) => arr.map((n) => n + 1))
      );
  }

  // Falls es nur exclusive gateways gibt
  if (!mapping) mapping = Array.from({ length: n }, (_, i) => [i]);

  return { mapping, deadlockPaths };
};
