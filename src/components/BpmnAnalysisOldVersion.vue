<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import Viewer from "bpmn-js/lib/Viewer";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry";
import type { Element } from "diagram-js/lib/model";
import type Canvas from "diagram-js/lib/core/Canvas";

type PGSplit = { id: string; outgoings: number };

type FindPathsResult = {
  allPaths: string[][];
  pgSplits: PGSplit[];
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
let verbose = true;

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

      const { allPaths, pgSplits } = findPaths(startElement, elementRegistry);
      paths.value.allPaths = allPaths;
      paths.value.mergedPaths = mergeParallelPaths(allPaths, pgSplits, verbose);
      console.log("Alle Parallel Gateways:", pgSplits);
      console.log(
        "Alle einzelnen Pfade:",
        nicePathList(paths.value.allPaths, elementRegistry)
      );
      console.log(
        "Alle zusammengeführten Pfade:",
        nicePathList(paths.value.mergedPaths, elementRegistry)
      );

      canvas = viewer.get("canvas");
      canvas.zoom("fit-viewport", "auto");
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
  const pgSplits: { id: string; outgoings: number }[] = [];

  const dfs = (
    currentElement: Element,
    currentPath: string[] = [],
    currentPathByTask: string[] = []
  ) => {
    currentPath.push(currentElement.id);

    if (currentElement.type == "bpmn:Task") {
      currentPathByTask.push(currentElement.businessObject.name);
    }

    if (currentElement.type == "bpmn:EndEvent") {
      allPaths.push([...currentPath]); // Speicher Kopie des Arrays
      return;
    }

    const outgoing: Element[] = currentElement.businessObject.outgoing || [];

    if (
      currentElement.type === "bpmn:ParallelGateway" &&
      outgoing.length > 1 &&
      !pgSplits.some((pg) => pg.id === currentElement.id)
    ) {
      pgSplits.push({ id: currentElement.id, outgoings: outgoing.length });
    }

    for (const flow of outgoing) {
      // const nextElement = flow.target;
      // Komischerweise: Wenn ich das Diagramm auf der Website manuell lade, muss ich businessObject benutzen (sonst outgoing ohne informationen) und nur per ID auf nextElement zugreifen.
      // flow.target ist nicht stabil, bei externem XML-import.
      const nextElement = elementRegistry.get(flow.targetRef.id) as Element;
      if (nextElement) {
        dfs(nextElement, [...currentPath], [...currentPathByTask]);
      }
    }
  };

  dfs(startingElement);

  if (allPaths.length === 0) {
    console.error("Die Funktion findPaths hat einen leeren Output ergeben.");
    alert("Bei der Tiefensuche der Pfade ist ein Fehler aufgetreten.");
  }

  return { allPaths, pgSplits };
};

// Wird nicht benutzt
const findSyncStart = function (a: string[], b: string[]): number | null {
  const minLength = Math.min(a.length, b.length);
  for (let i = 0; i < minLength; i++) {
    if (
      a
        .slice(a.length - minLength + i)
        .every((val, j) => val === b.slice(b.length - minLength + i)[j])
    ) {
      return minLength - i;
    }
  }
  return null;
};

/**
 * Prüft ob zwei Listen bis zu einem Index identisch sind und ein Index danach unterschiedlich sind.
 * Es kann auch geprüft werden, ob sie am Index danach auch unterschiedlich zu anderen Werten sind.
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

// console.log(
//   sameStartThenDifferent(["a", "b", "c"], ["a", "b", "cc", "dd"], 1, [
//     "cd",
//     "cc",
//   ])
// );

/**
 * Prüft ob zwei Listen, wenn sie nach einem Index den gleichen Wert haben, auch gleich enden.
 * Findet dann den Index heraus, ab dem sie gleich sind.
 * Falls sie keinen gleichen Wert mehr aufweisen, wird der Index -1 ausgegeben.
 * @param a
 * @param b
 * @param startIndex
 */
const findSameEndingIndex = function (
  a: string[],
  b: string[],
  startIndex: number
): number | null {
  for (let i = startIndex; i < a.length; i++) {
    if (b.includes(a[i])) {
      const indexB = b.indexOf(a[i]);
      if (
        a.slice(i).length === b.slice(indexB).length &&
        a.slice(i).every((val, j) => val === b.slice(indexB)[j])
      ) {
        return i;
      } else {
        return null;
      }
    }
  }
  return -1;
};

// console.log(
//   findSameEndingIndex(
//     ["a", "b", "c", "d"],
//     ["a", "b", "C", "D", "E", "F", "d"],
//     2
//   )
// );

/**
 * Versucht, einen Pfad i, der durch ein PG zum Zeitpunkt pgIndex geht, mit numOutgoings vielen Pfaden j>i zu mergen.
 * Dabei wird eine neue Kombination gesucht, welche noch nicht in pathCombinationsUsed gespeichert ist.
 * Bei Erfolg wird Pfad und aktualisierter pathCombinationsUsed ausgegeben, ansonsten null.
 * @param path
 * @param i
 * @param resultPaths
 * @param pgIndex
 * @param numOutgoings
 * @param outgoingsUsed
 * @param pathsUsed
 * @param pathCombinationsUsed
 * @param verbose bei true werden die wichtigen Schritte in der Konsole ausgegeben.
 */
const mergeNewPathDemo = function (
  path: string[],
  i: number,
  resultPaths: string[][],
  pgIndex: number,
  numOutgoings: number,
  outgoingsUsed: string[],
  pathsUsed: number[],
  pathCombinationsUsed: number[][],
  verbose: boolean = false
): { path: string[]; pathCombinationsUsed: number[][] } | null {
  // Iteriere über alle Pfad j>i, die nach dem letzten gemergten Pfad kommen.
  // Dabei soll keine Kombination entstehen, welche schon gemergt wurde
  for (let j = i + 1; j < resultPaths.length; j++) {
    const candidate = [...pathsUsed, j];
    if (
      (pathsUsed.length === 0 || j > pathsUsed[pathsUsed.length - 1]) &&
      !pathCombinationsUsed.some(
        (b) => JSON.stringify(b) === JSON.stringify(candidate)
      )
    ) {
      if (verbose) console.log("Untersuche Pfad", j);
      const mergingPath = resultPaths[j];
      // Prüfe ob j mit aktuellem Pfad gemergt werden kann
      if (sameStartThenDifferent(path, mergingPath, pgIndex, outgoingsUsed)) {
        const EndIndex = findSameEndingIndex(path, mergingPath, pgIndex + 1);
        if (EndIndex) {
          if (verbose) console.log("Pfade werden gemergt!");
          const newPath = [
            ...path.slice(0, EndIndex),
            ...mergingPath.slice(pgIndex + 1),
          ];
          // Speichere die benutzten Outgoings und die Pfadkombination
          const newOutgoingsUsed = [...outgoingsUsed, mergingPath[pgIndex + 1]];
          const newPathsUsed = [...pathsUsed, j];
          // Prüfe, ob genug Pfade zusammengefasst wurden.
          if (newPathsUsed.length + 1 === numOutgoings) {
            if (verbose) console.log("Genug Pfade wurden zusammengefasst.");
            pathCombinationsUsed.push(newPathsUsed);
            return { path: newPath, pathCombinationsUsed };
          } else {
            // Es wird der nächste Pfad gesucht, der dazu gemergt werden kann.
            const result = mergeNewPathDemo(
              newPath,
              i,
              resultPaths,
              pgIndex,
              numOutgoings,
              newOutgoingsUsed,
              newPathsUsed,
              pathCombinationsUsed,
              verbose
            );
            // Wenn das aktuelle Mergen zum Ziel führt, wird der zusammengefasste Pfad, mit seiner Kombination ausgegeben.
            // Ansonsten iteriert der Algorithmus weiter über j und versucht andere Kombinationen zu finden.
            if (result) return result;
          }
        }
      }
    }
  }
  if (verbose)
    console.log("Es wurde keine hinreichende Pfadkombination gefunden.");
  return null;
};

/**
 * Führt parallel laufende Pfade zusammen.
 * Diese werden als Liste ausgegeben wobei jedes Listenelement einem Pfad entspricht, der selbst eine Liste ist.
 * Pfade die parallele Stränge enthalten, werden elementweise aufgelistet, von Start bis Ende, wobei die parallelen
 * Stränge nacheinander aufgelistet werden.
 * @param allPaths
 * @param pgSplits
 * @param verbose bei true werden die wichtigen Schritte in der Konsole ausgegeben.
 */
const mergeParallelPaths = function (
  allPaths: string[][],
  pgSplits: { id: string; outgoings: number }[],
  verbose: boolean = false
): string[][] {
  let previousPaths = [...allPaths];

  for (const pg of pgSplits) {
    if (verbose) console.log("Betrachte PG:", pg);
    const finalPaths: string[][] = [];
    const numOutgoings = pg.outgoings;
    const pathProcessed: boolean[] = Array(previousPaths.length).fill(false);

    for (let i = 0; i < previousPaths.length; i++) {
      const pathCombinationsUsed: number[][] = [];
      const path = previousPaths[i];
      if (verbose) console.log("Betrachte Pfad", i + 1);
      if (!path.includes(pg.id)) {
        finalPaths.push(path);
        pathProcessed[i] = true;
        if (verbose) console.log("Pfad nicht angerührt:", i + 1);
      } else {
        const pgIndex = path.indexOf(pg.id);

        /**
         * Versucht, Pfad i, der durch pg zum Zeitpunkt pgIndex geht,
         * mit numOutgoings vielen Pfaden j>i zu mergen.
         * Dabei wird eine neue Kombination gesucht, welche noch nicht in pathCombinationsUsed gespeichert ist.
         * Ausgegeben wird der Pfad. pathCombinationsUsed und pathProceeded werden dabei aktualisiert.
         * @param path
         * @param outgoingsUsed
         * @param pathsUsed
         */
        const mergeNewPath: (
          path: string[],
          outgoingsUsed?: string[],
          pathsUsed?: number[]
        ) => string[] | null = (path, outgoingsUsed = [], pathsUsed = []) => {
          // Iteriere über alle Pfad j>i, die nach dem letzten gemergten Pfad kommen.
          // Dabei soll keine Kombination entstehen, welche schon gemergt wurde
          for (let j = i + 1; j < previousPaths.length; j++) {
            const candidate = [...pathsUsed, j];
            if (
              (pathsUsed.length === 0 || j > pathsUsed[pathsUsed.length - 1]) &&
              !pathCombinationsUsed.some(
                (b) => JSON.stringify(b) === JSON.stringify(candidate)
              )
            ) {
              if (verbose) console.log("Kandidat:", j + 1);
              const mergingPath = previousPaths[j];
              // Prüfe ob j mit aktuellem Pfad gemergt werden kann
              if (
                sameStartThenDifferent(
                  path,
                  mergingPath,
                  pgIndex,
                  outgoingsUsed
                )
              ) {
                const endIndex = findSameEndingIndex(
                  path,
                  mergingPath,
                  pgIndex + 1
                );
                if (endIndex) {
                  if (verbose) console.log("Gemerget mit", j + 1);
                  let mergedPath: string[];
                  if (endIndex == -1) {
                    mergedPath = [...path, ...mergingPath.slice(pgIndex + 1)];
                  } else
                    mergedPath = [
                      ...path.slice(0, endIndex),
                      ...mergingPath.slice(pgIndex + 1),
                    ];
                  // Speichere die benutzten Outgoings und die Pfadkombination
                  const updatedOutgoingsUsed = [
                    ...outgoingsUsed,
                    mergingPath[pgIndex + 1],
                  ];
                  const updatedPathsUsed = [...pathsUsed, j];
                  // Prüfe, ob genug Pfade zusammengefasst wurden.
                  if (updatedPathsUsed.length + 1 === numOutgoings) {
                    if (verbose) {
                      console.log("Genug Pfade wurden zusammengefasst.");
                      console.log(
                        "Pfade zusammengefügt:",
                        updatedPathsUsed.map((n) => n + 1)
                      );
                    }
                    pathCombinationsUsed.push(updatedPathsUsed);
                    pathProcessed[i] = true;
                    pathProcessed.map((val, k) =>
                      updatedPathsUsed.includes(k) ? true : val
                    );
                    return mergedPath;
                  } else {
                    // Es wird der nächste Pfad gesucht, der dazu gemergt werden kann.
                    const result = mergeNewPath(
                      mergedPath,
                      updatedOutgoingsUsed,
                      updatedPathsUsed
                    );
                    // Wenn das aktuelle Mergen zum Ziel führt, wird der zusammengefasste Pfad, mit seiner Kombination ausgegeben.
                    // Ansonsten iteriert der Algorithmus weiter über j und versucht andere Kombinationen zu finden.
                    if (result) return result;
                  }
                }
              }
            }
          }
          if (verbose)
            console.log(
              "Es wurde keine hinreichende Pfadkombination gefunden."
            );
          return null;
        };

        let hope = true;
        while (hope === true) {
          hope = false;
          if (verbose) console.log("Funktion mergeNewPath wird verwendet.");
          const merged = mergeNewPath(path);
          if (merged) {
            finalPaths.push(merged);
            hope = true;
            if (verbose) console.log("Pfade zusammengeführt zu:", path);
          }
        }
      }
    }
    previousPaths = finalPaths;
    if (verbose) console.log("Aktualisierte Pfade:", previousPaths);
    if (pathProcessed.includes(false)) {
      for (let i = 0; i < pathProcessed.length; i++) {
        if (pathProcessed[i] == false)
          console.error(`Der Pfad ${i + 1} ist verloren gegangen!`);
      }
    }
  }
  if (previousPaths.length === 0) {
    console.error(
      "Die Funktion mergeParallelPaths hat einen leeren Output ergeben."
    );
    alert("Beim Zusammenführen der Pfade ist ein Fehler aufgetreten.");
  }
  return previousPaths;
};

const mergeParallelPaths3Outgoings = function (
  allPaths: string[][],
  pgSplits: { id: string; outgoings: number }[]
): string[][] | null {
  for (const pg of pgSplits) {
    if (pg.outgoings != 3) {
      console.error(
        "Merging algorithm works only for diagramms with gateways-outgoings exactly 3."
      );
      alert("Only exactly 3 outgoings per parallel gateway allowed!");
      return null;
    }
  }

  let resultPaths = [...allPaths];

  for (const pg of pgSplits) {
    const newResultPaths: string[][] = [];
    for (let i = 0; i < resultPaths.length; i++) {
      const indexUsed: number[] = [];
      let path = resultPaths[i];
      if (!path.includes(pg.id)) {
        newResultPaths.push(path);
      } else {
        const pgIndex = path.indexOf(pg.id);
        let hope = true;
        let mergeFound = false;
        while (hope === true) {
          hope = false;
          for (let j = i + 1; j < resultPaths.length; j++) {
            const mergingPath1 = resultPaths[j];
            if (sameStartThenDifferent(path, mergingPath1, pgIndex)) {
              const EndIndex1 = findSameEndingIndex(
                path,
                mergingPath1,
                pgIndex + 1
              );
              if (EndIndex1) {
                path = [
                  ...path.slice(0, EndIndex1),
                  ...mergingPath1.slice(pgIndex + 1),
                ];
                for (let k = j + 1; k < resultPaths.length; k++) {
                  if (!indexUsed.includes(j) || !indexUsed.includes(k)) {
                    const mergingPath2 = resultPaths[k];
                    if (
                      sameStartThenDifferent(path, mergingPath2, pgIndex, [
                        mergingPath1[pgIndex + 1],
                      ])
                    ) {
                      const EndIndex2 = findSameEndingIndex(
                        path,
                        mergingPath2,
                        pgIndex + 1
                      );
                      if (EndIndex2) {
                        const mergedPath = [
                          ...path.slice(0, EndIndex2),
                          ...mergingPath2.slice(pgIndex + 1),
                        ];
                        newResultPaths.push(mergedPath);
                        hope = true;
                        mergeFound = true;
                        indexUsed.push(j, k);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    resultPaths = newResultPaths;
  }
  return resultPaths;
};

const mergeParallelPaths2Outgoings = function (
  allPaths: string[][],
  pgSplits: { id: string; outgoings: number }[]
): string[][] | undefined {
  for (const pg of pgSplits) {
    if (pg.outgoings > 2) {
      console.error(
        "Merging algorithm works only for diagramms with gateways-outgoings less than 3."
      );
      alert("Only 2 or less outgoings per parallel gateway allowed!");
      return null;
    }
  }

  let resultPaths = [...allPaths];

  for (const pg of pgSplits) {
    const newResultPaths: string[][] = [];

    for (let i = 0; i < resultPaths.length; i++) {
      const path = resultPaths[i];
      if (!path.includes(pg.id)) {
        newResultPaths.push(path);
      } else {
        const pgIndex = path.indexOf(pg.id);
        for (let j = i + 1; j < resultPaths.length; j++) {
          const mergingPath = resultPaths[j];
          if (sameStartThenDifferent(path, mergingPath, pgIndex)) {
            const EndIndex = findSameEndingIndex(
              path,
              mergingPath,
              pgIndex + 1
            );
            if (EndIndex) {
              const mergedPath = [
                ...path.slice(0, EndIndex),
                ...mergingPath.slice(pgIndex),
              ];
              newResultPaths.push(mergedPath);
            }
          }
        }
      }
    }
    resultPaths = newResultPaths;
  }
  return resultPaths;
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
      if (
        element
        // element.waypoints === undefined &&
        // element.type !== "bpmn:SequenceFlow"
      ) {
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

<!-- typescript soll keinen fehler geben wenn variable nicht benutzt wird -->
<!-- error handling verbessern -->
<!-- Example 3 macht Probleme: Die Pfadspeicherung von gemergten Phasen führt dazu, dass entsprechende
 Pfade beim zweiten Gateway nicht gemert werden.
 example 3 ist eh irrelevant!
 Dass sich parallele Pfade crashen, macht keinen Sinn.-->
<!-- Falsches Diagramm: Funktioniert auch nicht, weil zwei Ende und Pfadspeicherung dadurch schwierig. -->
<!-- Lösung: Parallele Pfade müssen erkennbar gespeichert werden!!! -->
