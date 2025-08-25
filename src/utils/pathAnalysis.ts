import { UserInputError } from "@/utils/error";
import type {
  SimpleElement,
  SimpleElementRegistry,
  Gateway,
  DeadlockPath,
  Verbose,
} from "@/types/bpmn";

/**
 * Find all start elements in the BPMN diagram.
 * @param elementRegistry The element registry containing all BPMN elements.
 * @returns An array of start elements.
 */
export const findStartElements = function (
  elementRegistry: SimpleElementRegistry
): SimpleElement[] {
  const startElements: SimpleElement[] = [];
  const allElements = elementRegistry.getAll();
  for (const el of allElements) {
    if (el.type === "bpmn:StartEvent") {
      startElements.push(el);
    }
  }
  return startElements;
};

/**
 * Findet alle Rohpfade im BPMN-Diagramm, beginnend von den angegebenen Start-Elementen mittels Tiefensuche (DFS).
 * Dabei werden alle Gateways als exklusive Gateways behandelt.
 * Ein Loop wird nur einmal durchlaufen.
 * Gleichzeitig werden alle Gateways abgespeichert.
 * Gateways, die aufgrund eines Loops zwei Mal durchlaufen werden, werden doppelt gespeichert.
 * Es sei denn, es sind Join-Gateways, welche den Loop beenden, dann bekommen sie die Eigenschaft isLoopGateway = true.
 * @param elementRegistry Das Element-Registry, das alle BPMN-Elemente enthält.
 * @param startElements Ein Array von Start-Elementen, von denen die Suche beginnt.
 * @param maxDepth Die maximale Tiefe für die Pfadsuche.
 * @param VERBOSE Optionen für ausführliche Protokollierung.
 * @returns Ein Objekt mit allen Rohpfaden als Liste von Listen von Strings und den gefundenen Gateways als Liste vom Typ Gateway.
 */
export const findRawPaths = function (
  elementRegistry: SimpleElementRegistry,
  startElements: SimpleElement[],
  maxDepth: number = 100,
  VERBOSE: Verbose = {}
): {
  allRawPaths: string[][];
  allGateways: Gateway[];
} {
  const allRawPaths: string[][] = [];
  const allGateways: Gateway[] = [];

  // Funktion, die für Tiefensuche rekursiv aufgerufen wird
  const dfs = (currentElement: SimpleElement, currentPath: string[] = []) => {
    if (currentPath.length >= maxDepth) {
      console.warn(
        "Maximale Pfadtiefe erreicht bei Element:",
        currentElement.id
      );
      return;
    }

    const occurences =
      currentPath.filter((id) => id === currentElement.id).length + 1;

    const isFirstRepeatedElement =
      occurences === 2 && new Set(currentPath).size === currentPath.length;

    // Stoppe, falls ein Loop das zweite Mal durchlaufen werden soll.
    if (occurences > 2) {
      return;
    }

    currentPath.push(currentElement.id);

    // Falls das aktuelle Element ein End-Event ist, wird der aktuelle Pfad gespeichert.
    if (currentElement.type === "bpmn:EndEvent") {
      allRawPaths.push([...currentPath]);
      if (VERBOSE.rawPaths) {
        console.log("Raw path hinzugefügt:", currentPath);
      }
      return;
    }

    let gatewayType: string | undefined;
    switch (currentElement.type) {
      case "bpmn:ExclusiveGateway":
        gatewayType = "exclusive";
        break;
      case "bpmn:ParallelGateway":
        gatewayType = "parallel";
        break;
      case "bpmn:InclusiveGateway":
        gatewayType = "inclusive";
        break;
      default:
        gatewayType = undefined;
        break;
    }
    const outgoing: SimpleElement[] =
      currentElement.businessObject?.outgoing || [];

    if (gatewayType) {
      const incoming: SimpleElement[] =
        currentElement.businessObject?.incoming || [];
      const direction =
        outgoing.length > incoming.length
          ? "split"
          : outgoing.length < incoming.length
          ? "join"
          : "join/split";
      const existentGateway = allGateways.find(
        (gw) => gw.id === currentElement.id
      );
      if (existentGateway) {
        if (isFirstRepeatedElement) {
          // Wenn das Gateway für einen Loop verantwortlich ist, aktualisiere die isLoopGateway-Eigenschaft
          existentGateway.isLoopGateway = true;
        } else {
          if (
            occurences == 2 &&
            !allGateways.find(
              (gw) =>
                gw.id === currentElement.id && gw.secondOccurrence === true
            )
          ) {
            // Wenn das Gateway durch einen Loop zwei Mal durchlaufen wird, aber nicht für den Loop verantwortlich ist, speichere es erneut ab mit secondOccurrence = true.
            allGateways.push({
              id: currentElement.id,
              type: gatewayType,
              direction: direction,
              incoming: incoming.length,
              outgoing: outgoing.length,
              secondOccurrence: true,
              isLoopGateway: false,
            });
          }
        }
      } else {
        // Wenn das Gateway das erste Mal durchlaufen wird, speichere es ab
        allGateways.push({
          id: currentElement.id,
          type: gatewayType,
          direction: direction,
          incoming: incoming.length,
          outgoing: outgoing.length,
          secondOccurrence: false,
          isLoopGateway: isFirstRepeatedElement,
        });
      }
    }

    for (const flow of outgoing) {
      const targetId = flow.targetRef?.id;
      if (!targetId) {
        throw new Error("Ein Flow hat kein Ziel-Element.");
      }
      const nextElement = elementRegistry.get(targetId);
      if (!nextElement) {
        throw new Error("Ein Flow hat kein Ziel-Element.");
      }
      dfs(nextElement, [...currentPath]);
    }
  };

  for (const startElement of startElements) {
    dfs(startElement);
  }

  if (allRawPaths.length === 0) {
    throw new Error("Die Funktion findPaths hat einen leeren Output ergeben.");
  }

  return { allRawPaths, allGateways };
};

/**
 * Verknüpft Join- und Split-Gateways miteinander und löscht doppelte Split-Gateways, welche Loops einleiten.
 * Für jedes Join-Gateway wird das passende Split-Gateway gesucht, sodass auf jedem Pfad,
 * der das Join-Gateway durchläuft, zuvor das Split-Gateway passiert wurde.
 * Bei geloopten Join-Gateways ist die Reihenfolge egal.
 * Falls ein Join-Gateway keinem Split-Gateway zugeordnet werden kann, wird geprüft,
 * ob es mit mehreren Start-Elementen verknüpft werden kann.
 * Split-Gateways ohne Gegenstück werden mit dem End-Element verknüpft.
 * @param gateways Liste aller Gateways
 * @param allRawPaths Alle Rohpfade
 * @param startElements Ein Array von Start-Elementen, von denen die Suche beginnt.
 * @param VERBOSE Optionen für ausführliche Protokollierung
 */
export const linkGateways = function (
  gateways: Gateway[],
  allRawPaths: string[][],
  startElements: SimpleElement[],
  VERBOSE: Verbose = {}
) {
  // Weise einem join gateway das erste split gateway zu, das die Eigenschaft hat, dass jeder Pfad
  // der das join gateway durchläuft, vorher das split gateway durchlaufen ist, es sei denn das joinGateway
  // leitet den Loop ein, in dem Fall, ist die Reihenfolge egal
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
            !path.includes(splitGateway.id) ||
            (!joinGateway.isLoopGateway &&
              path.indexOf(splitGateway.id) > path.indexOf(joinGateway.id)) ||
            joinGateway.secondOccurrence === !splitGateway.secondOccurrence
          ) {
            continue outer;
          }
        }
      }
      joinGateway.counterpart = splitGateway.id;
      splitGateway.counterpart = joinGateway.id;

      // Wenn das Join-Gateway den Loop beendet, muss das Split-Gateway ebenfalls als isLoopGateway markiert werden.
      // Die Gateways dürfen dann nur einmal gelistet sein, da sie für den Loop verantwortlich sind.
      if (joinGateway.isLoopGateway) {
        splitGateway.isLoopGateway = true;
        let indexToRemove = gateways.findIndex(
          (gw) => gw.id === splitGateway.id && gw.secondOccurrence === true
        );
        if (indexToRemove !== -1) {
          gateways.splice(indexToRemove, 1);
        }
      }
      if (VERBOSE.gateways)
        console.log(
          `Join Gateway ${joinGateway.id} (${joinGateway.type}, ${joinGateway.direction}, ${joinGateway.incoming}, ${joinGateway.secondOccurrence}) und Split Gateway ${splitGateway.id} (${splitGateway.type}, ${splitGateway.direction}, ${splitGateway.outgoing}, ${splitGateway.secondOccurrence}) wurden verknüpft.`
        );
      break;
    }
  }

  // Überprüfe, ob jedem join gateway ein eindeutiges split gateway zugewiesen werden konnte
  const joinGatewayCounterparts = new Set<String>([]);
  let joinGatewayCount = 0;
  for (const joinGateway of gateways.filter((gw) => gw.direction === "join")) {
    if (joinGateway.counterpart) {
      joinGatewayCount++;
      if (joinGateway.secondOccurrence) {
        joinGatewayCounterparts.add(`${joinGateway.counterpart}_1`);
      } else {
        joinGatewayCounterparts.add(joinGateway.counterpart);
      }
    } else {
      if (joinGateway.incoming === startElements.length) {
        joinGateway.counterpart = "start";
        if (VERBOSE.gateways)
          console.log(
            `Join Gateway ${joinGateway.id} (${joinGateway.type}, ${joinGateway.direction}, ${joinGateway.incoming}) wurde mit dem Start-Element verknüpft.`
          );
      } else {
        console.error(
          `Join Gateway ${joinGateway.id} (${joinGateway.type}, ${joinGateway.direction}, ${joinGateway.incoming}) konnte mit keinem Split Gateway oder mehreren Start-Elementen verknüpft werden.`
        );
        throw new UserInputError(
          "Die Gateways konnten nicht miteinander verknüpft werden."
        );
      }
    }
  }
  console.log(joinGatewayCounterparts);
  console.log(joinGatewayCount);
  if (joinGatewayCounterparts.size < joinGatewayCount) {
    console.error(
      "Zwei Join-Gateways wurde dasselbe Split-Gateway zugeordnet."
    );
    throw new UserInputError(
      "Die Gateways konnten nicht miteinander verknüpft werden."
    );
  }

  for (const splitGateway of gateways.filter(
    (gw) => gw.direction === "split"
  )) {
    if (!splitGateway.counterpart) {
      splitGateway.counterpart = "end";
      if (VERBOSE.gateways)
        console.log(
          `Split Gateway ${splitGateway.id} (${splitGateway.type}, ${splitGateway.direction}, ${splitGateway.outgoing}) wurde mit dem End-Element verknüpft.`
        );
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
 * Wenn Liste a ab einem startIndex den gleichen Wert wie b aufweist und beide Listen ab da gleich enden, wird der entsprechende
 * String ausgegeben.
 * Falls sie ab dem startIndex überhaupt keinen gleichen Wert aufweisen, wird "Seperate Ending" ausgegeben.
 * Ansonsten wird null ausgegeben.
 * @param a
 * @param b
 * @param startIndex
 */
const sameEndingIndex = function (
  a: string[],
  b: string[],
  startIndex: number
): string | null {
  let bIncludesValueOfA = false;
  for (let i = startIndex; i < a.length; i++) {
    if (b.includes(a[i])) {
      bIncludesValueOfA = true;
      const indexB = b.indexOf(a[i]);
      if (
        a.slice(i).length === b.slice(indexB).length &&
        a.slice(i).every((val, j) => val === b.slice(indexB)[j])
      ) {
        return a[i];
      }
    }
  }

  if (bIncludesValueOfA) {
    return null;
  } else {
    return "Seperate Ending";
  }
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
 * @param VERBOSE
 */
const mergePathsAtGateway = function (
  allRawPaths: string[][],
  gateway: Gateway,
  VERBOSE: Verbose = {}
): { mappingAtGateway: number[][]; deadlockPathsAtGateway: DeadlockPath[] } {
  if (VERBOSE.merging) {
    console.log(`Betrachte ${gateway.type} Gateway ${gateway.id}`);
  }
  const mapping: number[][] = [];
  const deadlockPaths: DeadlockPath[] = [];

  const n = allRawPaths.length;

  let numOutgoings: number[] = [];
  if (gateway.type === "parallel") {
    numOutgoings = [gateway.outgoing];
  } else {
    if (gateway.type === "inclusive") {
      numOutgoings = Array.from({ length: gateway.outgoing }, (_, i) => i + 1);
    }
  }

  for (const numOutgoing of numOutgoings) {
    // Zur Überprüfung, dass alle Pfade behandelt wurden
    const pathProcessed: boolean[] = Array(n).fill(false);

    if (VERBOSE.merging) {
      console.log(`Betrachte ${numOutgoing} Outgoings.`);
    }
    for (let i = 0; i < n; i++) {
      if (VERBOSE.merging) {
        console.log("Betrachte Pfad", i + 1);
      }
      const path = allRawPaths[i];
      if (!path.includes(gateway.id)) {
        mapping.push([i]);
        pathProcessed[i] = true;

        if (VERBOSE.merging) {
          console.log(
            `Pfad ${
              i + 1
            } wird als einzelner Merge hinzugefügt, da er dieses Gateway nicht durchläuft`
          );
        }
        continue;
      }
      if (numOutgoing === 1) {
        mapping.push([i]);
        pathProcessed[i] = true;

        if (VERBOSE.merging)
          console.log(
            `Pfad ${
              i + 1
            } wird als einzelner Merge hinzugefügt, da es 1 Outgoing gibt.`
          );
        continue;
      }
      const gatewayIndex = path.indexOf(gateway.id);

      /**
       * Versucht, Pfad i, der durch gateway zum Zeitpunkt gatewayIndex geht,
       * mit numOutgoing vielen Pfaden j>i zu mergen.
       * Dabei werden alle Pfadkombinationen betrachtet und diejenigen als Liste
       * von Indizes zu currentPathcombinations hinzugefügt, die die Merging-Bedingungen erfüllen.
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
          if (j <= pathsUsed[pathsUsed.length - 1]) continue;

          if (VERBOSE.merging) {
            console.log(`Überprüfe, ob Pfad ${j + 1} gemergt werden kann.`);
          }
          const mergingPath = allRawPaths[j];

          const endingElement = sameEndingIndex(
            path,
            mergingPath,
            gatewayIndex + 1
          );
          if (
            endingElement &&
            sameStartThenDifferent(
              path,
              mergingPath,
              gatewayIndex,
              outgoingsUsed
            )
          ) {
            if (
              gateway.counterpart &&
              endingElement != "Seperate Ending" &&
              gateway.counterpart != endingElement
            ) {
              continue;
            }
            if (VERBOSE.merging) {
              console.log(`Merge Pfad ${j + 1} dazu.`);
            }
            const updatedPathsUsed = [...pathsUsed, j];

            // Füge einen Deadlockpath hinzu, wenn der Pfad nicht zum Join Gateway zurückkommt und noch nicht
            // als Deadlockpath für dieses Gateway erfasst wurde
            if (
              gateway.counterpart &&
              !deadlockPaths.some((dp) => dp.pathIndex === j) &&
              !mergingPath.includes(gateway.counterpart)
            ) {
              if (VERBOSE.merging) {
                console.log(
                  `Pfad ${j + 1} kommt nicht zum Join Gateway ${
                    gateway.counterpart
                  } zurück.`
                );
              }
              const deadlockPath = {
                pathIndex: j,
                breakup: gateway.counterpart,
              };
              deadlockPaths.push(deadlockPath);
            }

            if (updatedPathsUsed.length === numOutgoing) {
              if (VERBOSE.merging) {
                console.log(
                  "Genug Pfade zusammengefügt:",
                  updatedPathsUsed.map((n) => n + 1)
                );
              }
              mapping.push(updatedPathsUsed);
              for (const k of updatedPathsUsed) {
                pathProcessed[k] = true;
              }
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
      };

      if (VERBOSE.merging) {
        console.log("Funktion mergeNewPath wird gestartet.");
      }
      mergeNewPath();
      if (VERBOSE.merging) {
        console.log("Funktion mergeNewPath wurde beendet.");
      }
    }

    if (pathProcessed.includes(false)) {
      for (let i = 0; i < pathProcessed.length; i++) {
        if (pathProcessed[i] === false) {
          throw new Error(
            `Der Pfad ${i + 1} ist beim Mergen an Gateway ${
              gateway.id
            } verloren gegangen!`
          );
        }
      }
    }
  }

  return { mappingAtGateway: mapping, deadlockPathsAtGateway: deadlockPaths };
};

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

export const realizePathCombination = function (
  pathCombination: number[],
  allRawPaths: string[][],
  deadlockPaths: DeadlockPath[]
): string[] {
  const realizedPathCombination: string[] = [];
  const breakupElements: string[] = [];

  for (const i of pathCombination) {
    const relevantDeadlockPaths = deadlockPaths.filter(
      (dp) => dp.pathIndex === i
    );
    for (const deadlockPath of relevantDeadlockPaths) {
      if (deadlockPath) {
        breakupElements.push(deadlockPath.breakup);
      }
    }
  }

  for (const i of pathCombination) {
    realizedPathCombination.push(...cutPath(allRawPaths[i], breakupElements));
  }
  return realizedPathCombination;
};

/**
 * Prüft ob der merged Pfad, den pathCombinationCandidate beschreibt schon durch eine pathCombination in
 * mapping beschrieben wird.
 * Falls ja, wird mapping aktualisiert ausgegeben, sodass die entsprechende Kombination durch
 * (redundante) Pfade erweitert wird, mit necessary = false.
 * Falls nein, wird pathCombinationCandidate zu mapping hinzugefügt und ausgegeben mit necessary = true.
 * @param pathCombination
 * @param mapping
 * @param allRawPaths
 */
const addingNecessary = function (
  pathCombinationCandidate: number[],
  mapping: number[][],
  allRawPaths: string[][],
  deadlockPaths: DeadlockPath[]
): { updatedMapping: number[][]; necessary: boolean } {
  const updatedMapping = mapping.map((comb) => [...comb]);
  let necessary = false;

  // Prüfe, ob die Pfadkombination schon genau so vertreten ist
  if (
    updatedMapping.some(
      (comb) =>
        JSON.stringify(comb) === JSON.stringify(pathCombinationCandidate)
    )
  )
    return { updatedMapping, necessary };

  // Betrachte die Pfadkombination, als Menge von Elementen der jeweiligen Pfade
  const mergedPathCandidate = new Set(
    realizePathCombination(pathCombinationCandidate, allRawPaths, deadlockPaths)
  );

  for (let i = 0; i < updatedMapping.length; i++) {
    // Teste ob eine bereits vertretene Pfadkombination, die selben Elemente beschreibt.
    const mergedPathTest = new Set(
      realizePathCombination(mapping[i], allRawPaths, deadlockPaths)
    );

    if (
      [...mergedPathTest].every((el) => mergedPathCandidate.has(el)) &&
      [...mergedPathCandidate].every((el) => mergedPathTest.has(el))
    ) {
      const merged = Array.from(
        new Set([...pathCombinationCandidate, ...updatedMapping[i]])
      ).sort((x, y) => x - y);

      // Füge die (redundanten) Pfadindices zur betrachteten Pfadkombination in mapping hinzu.
      updatedMapping[i] = merged;
      return { updatedMapping, necessary };
    }
  }

  updatedMapping.push(pathCombinationCandidate);
  necessary = true;

  return { updatedMapping, necessary };
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
const mergeMappings = function (
  first: number[][],
  second: number[][],
  allRawPaths: string[][],
  deadlockPaths: DeadlockPath[]
): number[][] {
  if (first.every((comb) => comb.length === 1)) {
    return second;
  }

  let mapping: number[][] = [];

  for (const a of first) {
    let i = 0;
    let mergingSucessful = false;
    /**
     * Fasst Liste a mit Listen aus second zusammen.
     * Für jeden Index von a wird eine Liste aus second gesucht, die a[Index] enthält.
     * Diese Liste wird dann zu a hinzugefügt.
     * Alle Kombinationen werden gesucht.
     * @param index
     * @param pathCombinationSet
     */
    const findElementFromSecond = (
      index = i,
      pathCombinationSet = new Set(a)
    ) => {
      for (let j = 0; j < second.length; j++) {
        const b = second[j];
        if (b.includes(a[index])) {
          const updatedPathCombinationSet = new Set([
            ...pathCombinationSet,
            ...b,
          ]);
          if (index + 1 < a.length) {
            findElementFromSecond(index + 1, updatedPathCombinationSet);
          } else {
            const { updatedMapping, necessary } = addingNecessary(
              Array.from(updatedPathCombinationSet).sort((x, y) => x - y),
              mapping,
              allRawPaths,
              deadlockPaths
            );
            mapping = updatedMapping;
            mergingSucessful = true;
          }
        }
      }
    };

    findElementFromSecond();
    if (mergingSucessful === false)
      throw new Error(
        "Im Mapping des aktuellen Gateways ist ein Pfadindex nicht vertreten."
      );
  }

  return mapping;
};

/**
 * Führt Pfade zusammen.
 * Benutzt mergePathsAtGateway an jedem Gateway und mergeMatchingLists um Gateway-Kombinationen zusammenzuführen.
 * @param allRawPaths
 * @param gateways
 * @param VERBOSE.
 */
export const mergePaths = function (
  allRawPaths: string[][],
  gateways: Gateway[],
  VERBOSE: Verbose = {}
): { mapping: number[][]; deadlockPaths: DeadlockPath[] } {
  let mapping: number[][] = Array.from(
    { length: allRawPaths.length },
    (_, i) => [i]
  );
  const deadlockPaths: DeadlockPath[] = [];

  for (const gateway of gateways.filter(
    (gw) => gw.type !== "exclusive" && gw.direction === "split"
  )) {
    const { mappingAtGateway, deadlockPathsAtGateway } = mergePathsAtGateway(
      allRawPaths,
      gateway,
      VERBOSE
    );
    deadlockPaths.push(...deadlockPathsAtGateway);

    if (VERBOSE.mapping) {
      console.log(
        "Zusammengefasste Pfade der vorherigen Gateways:",
        mapping.map((arr) => arr.map((n) => n + 1))
      );
      console.log(
        `Zusammengefasste Pfade an split gateway (${gateway.id}, ${gateway.type}, ${gateway.outgoing}):`,
        mappingAtGateway.map((arr) => arr.map((n) => n + 1))
      );
    }

    const updatedMapping = mergeMappings(
      mapping,
      mappingAtGateway,
      allRawPaths,
      deadlockPaths
    );

    if (VERBOSE.mapping)
      console.log(
        "Resultierende Pfade:",
        updatedMapping.map((arr) => arr.map((n) => n + 1))
      );
    mapping = updatedMapping;
  }

  return { mapping, deadlockPaths };
};
