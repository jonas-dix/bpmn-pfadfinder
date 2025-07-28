<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import Viewer from "bpmn-js/lib/Viewer";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type { Element } from "diagram-js/lib/model";
import type Canvas from "diagram-js/lib/core/Canvas";
import { all } from "axios";

type Gateway = {
  id: string;
  type: string;
  direction: string;
  incoming: number;
  outgoing: number;
  counterpart?: string;
};

type FindPathsResult = {
  allPaths: string[][];
  gateways: Gateway[];
};

type DeadlockPath = {
  pathIndex: number;
  breakup: string;
};

let viewer: Viewer;
let canvas: Canvas;
let elementRegistry: ElementRegistry;
const paths = ref<{ allPaths: string[][]; mergedPaths: string[][] }>({
  allPaths: [],
  mergedPaths: [],
});
const selectedPathIndex = ref<number | null>(null);
const program = ref<string>("Zusammengeführte Pfade");
const consideredPaths = computed(() => {
  if (program.value === "Einzelne Pfade") {
    return paths.value.allPaths;
  } else if (program.value === "Zusammengeführte Pfade") {
    return paths.value.mergedPaths;
  }
  return [];
});
let verbose = [false, false];

onMounted(() => {
  // Erstelle Viewer-Instanz mit id=diagramm
  viewer = new Viewer({ container: "#diagramm" });
});

const loadDiagramm = async (event: Event) => {
  // Datei aus dem <input> extrahieren
  const file = (event.target as HTMLInputElement).files?.[0];

  // Der Typ von file ist danach File
  if (!file) {
    console.error("Keine Datei ausgewählt.");
    alert("Fehler beim Auswählen der Datei.");
    return;
  }

  const reader = new FileReader();

  // Wenn Datei gelesen wurde, wird reader initialisiert
  reader.onload = async () => {
    const bpmnXML = reader.result as string;

    try {
      await viewer?.importXML(bpmnXML);

      if (!viewer) {
        return;
      }

      elementRegistry = viewer.get("elementRegistry") as ElementRegistry;

      const startElement = elementRegistry
        .getAll()
        .find((el) => el.type === "bpmn:StartEvent") as Element;

      // console.log(startElement.outgoing);
      // console.log(startElement.businessObject.outgoing);

      const { allPaths, gateways } = findPaths(startElement, elementRegistry);
      linkGateways(gateways, allPaths);
      console.log(
        "Gateways with counterparts:",
        gateways.map((gw) => [gw.id, gw.incoming, gw.outgoing, gw.counterpart])
      );
      paths.value.allPaths = allPaths;
      const [mapping, deadlockPaths] = mergeAllPaths(
        allPaths,
        gateways,
        verbose
      );
      console.log(
        "Deadlock Paths:",
        deadlockPaths.map((deadlockPath) => [
          deadlockPath.pathIndex + 1,
          deadlockPath.breakup,
        ])
      );
      paths.value.mergedPaths = createMergedPaths(
        mapping,
        deadlockPaths,
        allPaths
      );
      console.log("Alle Gateways:", gateways);
      console.log(
        "Alle einzelnen Pfade:",
        nicePathList(paths.value.allPaths, elementRegistry)
      );
      console.log(allPaths);
      console.log(
        "Alle zusammengeführten Pfade:",
        nicePathList(paths.value.mergedPaths, elementRegistry)
      );

      canvas = viewer.get("canvas");
      canvas.zoom("fit-viewport");
      selectedPathIndex.value = null;
    } catch (error) {
      console.error("Fehler beim Importieren der BPMN-Datei:", error);
      alert("Das BPMN-Diagramm konnte nicht geladen werden.");
    }
  };

  reader.readAsText(file);
};

/**
 * Berechnet alle Pfade, ausgehend von currentElement als Tiefensuche (DFS).
 * Dabei werden alle Gateways als Exclusive Gateways aufgefasst.
 * @param startingElement
 * @param elementRegistry
 */
const findPaths = function (
  startingElement: Element,
  elementRegistry: ElementRegistry
): FindPathsResult {
  const allPaths: string[][] = [];
  const gateways: Gateway[] = [];

  const dfs = (currentElement: Element, currentPath: string[] = []) => {
    currentPath.push(currentElement.id);

    if (currentElement.type == "bpmn:EndEvent") {
      allPaths.push([...currentPath]); // Speicher Kopie des Arrays
      return;
    }

    const type =
      currentElement.type === "bpmn:ParallelGateway"
        ? "parallel"
        : currentElement.type === "bpmn:InclusiveGateway"
        ? "inclusive"
        : null;
    const outgoing: Element[] = currentElement.businessObject.outgoing || [];
    const incoming: Element[] = currentElement.businessObject.incoming || [];
    const direction = outgoing.length > incoming.length ? "split" : "join";

    if (type && !gateways.some((pg) => pg.id === currentElement.id)) {
      gateways.push({
        id: currentElement.id,
        type: type,
        direction: direction,
        incoming: incoming.length,
        outgoing: outgoing.length,
      });
    }

    for (const flow of outgoing) {
      // const nextElement = flow.target;
      // Komischerweise: Wenn ich das Diagramm auf der Website manuell lade, muss ich businessObject benutzen (sonst outgoing ohne informationen) und nur per ID auf nextElement zugreifen.
      // flow.target ist nicht stabil, bei externem XML-import.
      const nextElement = elementRegistry.get(flow.targetRef.id) as Element;
      if (nextElement) {
        dfs(nextElement, [...currentPath]);
      }
    }
  };

  dfs(startingElement);

  if (allPaths.length === 0) {
    console.error("Die Funktion findPaths hat einen leeren Output ergeben.");
    alert("Bei der Tiefensuche der Pfade ist ein Fehler aufgetreten.");
  }

  return { allPaths, gateways };
};

/**
 * Ergänzt die Gateways mit der Eigenschaft counterpart, welche die ID des zugehörigen Split/Join-Gateway angibt.
 * @param gateways
 * @param allPaths
 */
const linkGateways = function (gateways: Gateway[], allPaths: string[][]) {
  for (const joinGateway of gateways
    .filter((gw) => gw.direction === "join")
    .slice()
    .reverse()) {
    outer: for (const splitGateway of gateways
      .filter((gw) => gw.direction === "split")
      .slice()
      .reverse()) {
      for (const path of allPaths) {
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
      joinGateway.counterpart = splitGateway.id;
      splitGateway.counterpart = joinGateway.id;
      console.log(
        `Join Gateway ${joinGateway.id} und Split Gateway ${splitGateway.id} gehören zusammen.`
      );
      break;
    }
  }

  for (const gateway of gateways) {
    if (gateway.counterpart === "unknown") {
      console.error("Die Parallel Gateway Zuordnung funktioniert nicht.");
      alert("Das Bpmn-Diagramm ist fehlerhaft.");
    }
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
const findSameEndingIndex = function (
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
 * Führt entsprechende Pfade an einem Gateway (parallel oder exclusive) zusammen.
 * Gateway.outgoing viele Pfade werden zusammengefügt.
 * Pfade werden gemergt, wenn sie das Gateway durchlaufen, dieselbe Vorgeschichte haben und, wenn sie an einem späteren Zeitpunkt sich überschneiden, zusammen bleiben,
 * bzw., wenn sie vollkommen getrennt bleiben.
 * In letzterem Fall wird der Pfad, der getrennt bleibt, also nicht mehr durch das Join Gateway läuft, als DeadlockPath aufgefasst.
 * Das bedeutet, dass die Pfade alle nur bis zum Deadlockelement laufen.
 * @param allPaths
 * @param gateway
 * @param verbose
 */
const mergeGatewayPaths = function (
  allPaths: string[][],
  gateway: Gateway,
  verbose: boolean[] = [false, false]
): [number[][], DeadlockPath[]] | undefined {
  if (!gateway.counterpart) {
    console.error(
      `Gateway ${gateway.id} konnte kein Counterpart zugewiesen werden.`
    );
    alert("Das Bpmn-Diagramm ist fehlerhaft.");
    return;
  }

  const pathCombinations: number[][] = [];
  const deadlockPaths: DeadlockPath[] = [];

  const n = allPaths.length;

  if (verbose[0])
    console.log(`Betrachte Gateway ${gateway.id} vom Typ ${gateway.type}`);
  let vecOutgoings: number[] = [];
  if (gateway.type === "parallel") {
    vecOutgoings = [gateway.outgoing];
  } else {
    if (gateway.type === "inclusive") {
      vecOutgoings = Array.from(
        { length: gateway.outgoing },
        (_, i) => gateway.outgoing - i
      );
    }
  }

  // Zur Überprüfung, dass alle Pfade behandelt wurden
  const pathProcessed: boolean[] = Array(n).fill(false);

  for (const numOutgoings of vecOutgoings) {
    if (verbose[0]) console.log("Zahl der outgoings:", numOutgoings);
    for (let i = 0; i < n; i++) {
      const path = allPaths[i];
      if (verbose[0]) console.log("Betrachte Pfad", i + 1);
      if (!path.includes(gateway.id)) {
        pathCombinations.push([i]);
        pathProcessed[i] = true;
        if (verbose[0])
          console.log(`Pfad ${i + 1} passierte dieses Gateway nicht.`);
        continue;
      }
      if (numOutgoings == 1) {
        pathCombinations.push([i]);
        pathProcessed[i] = true;
        if (verbose[0]) console.log(`Pfad ${i + 1} hinzugefügt.`);
        continue;
      }
      const gatewayIndex = path.indexOf(gateway.id);

      /**
       * Versucht, Pfad i, der durch gateway zum Zeitpunkt gatewayIndex geht,
       * mit numOutgoings vielen Pfaden j>i zu mergen.
       * Dabei wird eine neue Kombination gesucht, welche noch nicht in pathCombinationsUsed gespeichert ist.
       * Ausgegeben wird der Pfad. pathCombinationsUsed, pathProcessed, deadlockPaths werden dabei aktualisiert.
       * @param outgoingsUsed
       * @param pathsUsed
       */
      const mergeNewPath: (
        pathsUsed?: number[],
        outgoingsUsed?: string[]
      ) => number[] | null = (
        pathsUsed = [i],
        outgoingsUsed = [path[gatewayIndex]]
      ) => {
        // Iteriere über alle Pfad j>i, die nach dem letzten gemergten Pfad kommen.
        // Dabei soll keine Kombination entstehen, welche schon gemergt wurde.
        for (let j = i + 1; j < n; j++) {
          const updatedPathsUsed = [...pathsUsed, j];
          if (
            j > pathsUsed[pathsUsed.length - 1] &&
            !pathCombinations.some(
              (b) => JSON.stringify(b) === JSON.stringify(updatedPathsUsed)
            )
          ) {
            if (verbose[0])
              console.log(`Überprüfe ob Pfad ${j + 1} gemergt werden kann.`);
            const mergingPath = allPaths[j];
            if (
              sameStartThenDifferent(
                path,
                mergingPath,
                gatewayIndex,
                outgoingsUsed
              )
            ) {
              if (findSameEndingIndex(path, mergingPath, gatewayIndex + 1)) {
                if (!gateway.counterpart) return null;
                if (
                  !deadlockPaths.some((dp) => dp.pathIndex === j) &&
                  !mergingPath.includes(gateway.counterpart)
                ) {
                  const deadlockPath = {
                    pathIndex: j,
                    breakup: gateway.counterpart,
                  };
                  deadlockPaths.push(deadlockPath);
                }
                if (verbose[0]) console.log("Merging erfolgreich.");
                // Speichere die benutzten Outgoings
                const updatedOutgoingsUsed = [
                  ...outgoingsUsed,
                  mergingPath[gatewayIndex + 1],
                ];
                // Prüfe, ob genug Pfade zusammengefasst wurden.
                if (updatedPathsUsed.length === numOutgoings) {
                  if (verbose[0]) {
                    console.log(
                      "Genug Pfade für dieses Gateway zusammengeführt:",
                      updatedPathsUsed.map((n) => n + 1)
                    );
                  }
                  pathCombinations.push(updatedPathsUsed);
                  for (const k of updatedPathsUsed) pathProcessed[k] = true;
                  return updatedPathsUsed;
                } else {
                  // Es wird der nächste Pfad gesucht, der dazu gemergt werden kann.
                  const result = mergeNewPath(
                    updatedPathsUsed,
                    updatedOutgoingsUsed
                  );
                  // Wenn das aktuelle Mergen zum Ziel führt, wird der zusammengefasste Pfad, mit seiner Kombination ausgegeben.
                  // Ansonsten iteriert der Algorithmus weiter über j und versucht andere Kombinationen zu finden.
                  if (result) return result;
                }
              }
            }
          }
        }
        if (verbose[0])
          console.log("Es wurde keine hinreichende Pfadkombination gefunden.");
        return null;
      };

      let hope = true;
      while (hope === true) {
        hope = false;
        if (verbose[0]) console.log("Funktion mergeNewPath wird gestartet.");
        const merged = mergeNewPath();
        if (merged) {
          hope = true;
        }
      }
    }
  }
  if (pathProcessed.includes(false)) {
    for (let i = 0; i < pathProcessed.length; i++) {
      if (pathProcessed[i] == false)
        console.error(`Der Pfad ${i + 1} ist verloren gegangen!`);
    }
  }
  return [pathCombinations, deadlockPaths];
};

/**
 * Führt Pfade zusammen.
 * @param allPaths
 * @param gateways
 * @param verbose bei true werden die wichtigen Schritte in der Konsole ausgegeben.
 */
const mergeAllPaths = function (
  allPaths: string[][],
  gateways: Gateway[],
  verbose: boolean[] = [false, false]
): [number[][], DeadlockPath[]] {
  const n = allPaths.length;

  let mapping = Array.from({ length: n }, (_, i) => [i]);
  const deadlockPaths: DeadlockPath[] = [];

  for (const gateway of gateways) {
    const resultMergeGatewayPaths = mergeGatewayPaths(
      allPaths,
      gateway,
      verbose
    );
    if (!resultMergeGatewayPaths) continue;
    const [gatewayMapping, deadlockPathsGateway] = resultMergeGatewayPaths;
    deadlockPaths.push(...deadlockPathsGateway);
    const directMapping = mergeMatchingLists([...mapping], gatewayMapping);
    mapping = simplifyMapping(directMapping, allPaths);
    if (verbose[1]) {
      console.log(
        "Zusammengefasste Pfade an diesem Gateway:",
        gatewayMapping.map((arr) => arr.map((n) => n + 1))
      );
      console.log(
        "Resultierende Pfade:",
        directMapping.map((arr) => arr.map((n) => n + 1))
      );
      console.log(
        "Vereinfachte Pfade:",
        mapping.map((arr) => arr.map((n) => n + 1))
      );
    }
  }
  return [mapping, deadlockPaths];
};

function mergeMatchingListsOld(
  first: number[][],
  second: number[][]
): number[][] {
  const unfiltered: number[][] = [];
  for (const a of first) {
    for (const b of second) {
      const merged = new Set(a);
      if (b.some((x) => a.includes(x))) {
        b.forEach((x) => merged.add(x));
      }
      unfiltered.push(Array.from(merged).sort((x, y) => x - y));
    }
  }

  console.log("unfiltered:", unfiltered);
  let result: number[][] = unfiltered;
  result = unfiltered.filter(
    (a, i) =>
      !unfiltered.some(
        (b, j) =>
          i !== j && a.length < b.length && a.every((x) => b.includes(x))
      )
  );

  let filtered = result.filter((arr, index, self) => {
    const key = JSON.stringify(arr);
    return index === self.findIndex((a) => JSON.stringify(a) === key);
  });

  return filtered;
}

function mergeMatchingLists(first: number[][], second: number[][]): number[][] {
  const result: number[][] = [];
  for (const a of first) {
    let i = 0;
    const findb = (index = i, merged = new Set(a), count = 0) => {
      for (let j = 0; j < second.length; j++) {
        const b = second[j];
        const updatedMerged = new Set(merged);
        if (b.includes(a[index])) {
          b.forEach((el) => updatedMerged.add(el));
          if (index < a.length - 1) {
            findb(index + 1, updatedMerged);
          } else {
            result.push(Array.from(updatedMerged).sort((x, y) => x - y));
          }
        }
      }
    };
    findb();
  }
  let filtered = result.filter((arr, index, self) => {
    const key = JSON.stringify(arr);
    return index === self.findIndex((a) => JSON.stringify(a) === key);
  });
  return filtered;
}

// console.log(
//   mergeMatchingLists(
//     [[1], [2], [3]],
//     [
//       [1, 2],
//       [2, 3],
//       [1, 3],
//     ]
//   )
// );

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

const pathUpTo = function (path: string[], breakupElements: string[]) {
  if (breakupElements.length === 0) return path;

  const cutPath: string[] = [];
  for (const element of path) {
    cutPath.push(element);
    if (breakupElements.includes(element)) break;
  }
  return cutPath;
};

const createMergedPaths = function (
  mapping: number[][],
  deadlockPaths: DeadlockPath[],
  allPaths: string[][]
): string[][] {
  const allMergedPaths: string[][] = [];

  for (const comb of mapping) {
    const mergedPath: string[] = [];

    const breakupElements: string[] = [];
    for (const i of comb) {
      const deadlockPath = deadlockPaths.find((dp) => dp.pathIndex === i);
      if (deadlockPath) breakupElements.push(deadlockPath.breakup);
    }
    for (const i of comb) {
      mergedPath.push(...pathUpTo(allPaths[i], breakupElements));
    }
    allMergedPaths.push(mergedPath);
  }
  return allMergedPaths;
};

const nicePath = function (
  path: string[],
  elementRegistry: ElementRegistry
): string[] {
  const nice: string[] = [];
  for (const id of path) {
    const element = elementRegistry.get(id) as Element;
    if (element.type === "bpmn:Task") {
      nice.push(element.businessObject.name);
    } else if (element.type === "bpmn:ParallelGateway") {
      nice.push("Parallel Gateway");
    } else if (element.type === "bpmn:ExclusiveGateway") {
      nice.push("Exclusive Gateway");
    } else if (element.type === "bpmn:EndEvent") {
      nice.push("End");
    } else if (element.type === "bpmn:StartEvent") {
      nice.push("Start");
    } else nice.push(id);
  }
  return nice;
};

const nicePathList = function (
  pathList: string[][],
  elementRegistry: ElementRegistry
): string[][] {
  const niceList: string[][] = [];
  for (const path of pathList) {
    niceList.push(nicePath(path, elementRegistry));
  }
  return niceList;
};

const highlightPath = function () {
  canvas = viewer.get("canvas");
  // Markierungen entfernen
  elementRegistry
    .getAll()
    .forEach((el) => canvas.removeMarker(el.id, "highlight"));

  if (selectedPathIndex.value !== null) {
    const path = consideredPaths.value[selectedPathIndex.value];
    console.log("Highlighted Path:", nicePath(path, elementRegistry));
    for (const id of path) {
      const element = elementRegistry.get(id);
      if (element) {
        canvas.addMarker(id, "highlight");
      }
    }
  }
};

const nextPath = () => {
  if (consideredPaths.value.length === 0) {
    console.error("Es gibt keine Pfade zur Auswahl.");
  } else {
    if (
      selectedPathIndex.value === null ||
      selectedPathIndex.value === consideredPaths.value.length - 1
    ) {
      selectedPathIndex.value = 0;
    } else if (selectedPathIndex.value < consideredPaths.value.length - 1) {
      selectedPathIndex.value++;
    }
    highlightPath();
  }
};

const previousPath = () => {
  if (consideredPaths.value.length === 0) {
    console.error("Es gibt keine Pfade zur Auswahl.");
  } else {
    if (selectedPathIndex.value === null || selectedPathIndex.value === 0) {
      selectedPathIndex.value = consideredPaths.value.length - 1;
    } else if (selectedPathIndex.value > 0) {
      selectedPathIndex.value--;
    }
    highlightPath();
  }
};

const toggleProgram = () => {
  if (program.value === "Einzelne Pfade") {
    program.value = "Zusammengeführte Pfade";
  } else if (program.value === "Zusammengeführte Pfade") {
    program.value = "Einzelne Pfade";
  }
  if (consideredPaths.value.length === 0) {
    console.error("Es gibt keine Pfade zur Auswahl.");
    selectedPathIndex.value = null;
  } else {
    selectedPathIndex.value = 0;
    highlightPath();
  }
};
</script>

<template>
  <input type="file" accept=".bpmn" @change="loadDiagramm" />
  <div
    id="diagramm"
    style="width: 100%; height: 600px; border: 1px solid #ccc"
  ></div>
  <select v-model="selectedPathIndex" @change="highlightPath">
    <option :value="null">Pfad auswählen</option>
    <!-- disabled -->
    <!-- <option :value="null">Alle Pfade</option> -->
    <option
      v-for="(path, index) in consideredPaths"
      :key="index"
      :value="index"
    >
      Pfad {{ index + 1 }}
    </option>
  </select>
  <button @click="previousPath">◀</button>
  <button @click="nextPath">▶</button>
  <button @click="toggleProgram" style="margin-left: 1rem">
    {{ program }}
  </button>
</template>

<style>
.djs-element.highlight > .djs-visual > :nth-child(1) {
  stroke: orange !important;
  stroke-width: 4px !important;
  fill-opacity: 0.2 !important;
}
</style>

<!-- npx tsc --noEmit -->

<!-- error handling verbessern -->

<!-- continue und break benutzen -->

<!-- Annotation pro Pfad an Start mit Entscheidungen die bei den Exclusive Gateways für diesen Pfad getroffen wurden. -->

<!-- Pro Pfad Anzeige- und Speicheroption des Diagramms mit Annotation. -->

<!-- Highlighting sollte auch Pfeile mit einbeziehen. -->

<!-- Tesfälle schreiben -->

<!-- Mit Klassen arbeiten -->
