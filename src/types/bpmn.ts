export type Gateway = {
  id: string;
  type: string;
  direction: string;
  incoming: number;
  outgoing: number;
  isLoopGateway: boolean;
  secondOccurrence: boolean;
  counterpart?: string;
};

export type DeadlockPath = {
  pathIndex: number;
  breakup: string;
};

export type SimpleElement = {
  id: string;
  businessObject?: any;
  type?: string;
  targetRef?: { id: string };
};

export type SimpleElementRegistry = {
  getAll(): SimpleElement[];
  get(id: string): SimpleElement | undefined;
};

export type Verbose = {
  rawPaths?: boolean;
  gateways?: boolean;
  merging?: boolean;
  mapping?: boolean;
  overview?: boolean;
};

export type FilterOption = { id: string; label: string };
