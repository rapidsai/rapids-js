import {DataFrame, Table, TypeMap} from '@rapidsai/cudf';

export declare function getTableScanInfo(logicalPlan: string): [string[], string[]];

export declare function runGenerateGraph(masterIndex: number,
                                         workerIds: string[],
                                         dataframes: DataFrame[],
                                         tableNames: string[],
                                         tableScans: string[],
                                         ctxToken: number,
                                         query: string,
                                         configOptions: Record<string, unknown>,
                                         sql: string,
                                         currentTimestamp: string): ExecutionGraph;

export declare function runGeneratePhysicalGraph(
  masterIdex: number, workerIds: string[], ctxToken: number, query: string): string;

export declare function startExecuteGraph(executionGraph: ExecutionGraph, ctxToken: number): void;

export declare function getExecuteGraphResult(executionGraph: ExecutionGraph,
                                              ctxToken: number): {names: string[], tables: Table[]};

export type WorkerUcpInfo = {
  workerId: string,
  ip: string,
  port: number,
  ucpContext: UcpContext,
}

export type ContextProps = {
  ralId: number; workerId: string; networkIfaceName: string; ralCommunicationPort: number;
  workersUcpInfo: WorkerUcpInfo[];
  singleNode: boolean;
  configOptions: Record<string, unknown>;
  allocationMode: string;
  initialPoolSize: number | null;
  maximumPoolSize: number | null;
  enableLogging: boolean;
};

export declare class Context {
  constructor(props: ContextProps);

  addToCache<T extends TypeMap>(messageId: string, ralId: number, input: DataFrame<T>): void;
  pullFromCache(messageId: string): {names: string[], table: Table};
}

export declare class ExecutionGraph {
  constructor();

  start(): void;
  result(): {names: string[], tables: Table[]};
}

export declare class UcpContext {
  constructor();
}
