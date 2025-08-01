export type ExpectedCase =
  | {
      file: string;
      numberRawPaths: number;
      numberMergedPaths: number;
      shouldFail?: false;
    }
  | {
      file: string;
      shouldFail: true;
    };
