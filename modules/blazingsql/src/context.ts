// Copyright (c) 2021, NVIDIA CORPORATION.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {DataFrame, DataType, Series, TypeMap} from '@rapidsai/cudf';
import {callMethodSync, callStaticMethodSync} from 'java';

import {
  Context,
  ContextProps,
  getTableScanInfo,
  parseSchema,
  runGeneratePhysicalGraph,
} from './addon';
import {
  ArrayList,
  BlazingSchema,
  CatalogColumnImpl,
  CatalogDatabaseImpl,
  CatalogTableImpl,
  RelationalAlgebraGenerator
} from './algebra';
import {defaultContextConfigValues} from './config';
import {ExecutionGraph} from './graph';
import {json_plan_py} from './json_plan';

export class SQLContext {
  public readonly context: Context;
  declare private _db: any;
  declare private _schema: any;
  declare private _generator: any;
  declare private _tables: Map<string, DataFrame>;
  declare private _configOptions: Record<string, unknown>;

  constructor(options: Partial<ContextProps> = {}) {
    this._db        = CatalogDatabaseImpl('main');
    this._schema    = BlazingSchema(this._db);
    this._generator = RelationalAlgebraGenerator(this._schema);
    this._tables    = new Map<string, DataFrame>();

    const {
      id               = 0,
      port             = 0,
      networkIfaceName = 'lo',
      workersUcpInfo   = [],
      allocationMode   = 'cuda_memory_resource',
      initialPoolSize  = null,
      maximumPoolSize  = null,
      enableLogging    = false,
      ucpContext,
    } = options;

    this._configOptions = {...defaultContextConfigValues, ...options.configOptions};

    this.context = new Context({
      id,
      port,
      networkIfaceName,
      ucpContext,
      workersUcpInfo,
      configOptions: this._configOptions,
      allocationMode,
      initialPoolSize,
      maximumPoolSize,
      enableLogging
    });
  }

  // Temp definition, merge with createTable probably.
  public createTableCSV(tableName: string, input: string[]): void {
    console.log(tableName);
    const schema       = parseSchema(input, 'csv', [], [], false);
    const mappingFiles = {'localhost': schema['files']};

    console.log(schema);
    console.log(mappingFiles);

    const uriValues: any[] = [];
    const fileType         = schema['file_type'];

    console.log(uriValues);
    console.log(fileType);
  }

  /**
   * Create a SQL table to be used for future queries.
   *
   * @param tableName Name of the table when referenced in a query
   * @param input Data source for the table
   *
   * @example
   * ```typescript
   * import {Series, DataFrame, Int32} from '@rapidsai/cudf';
   * import {SQLContext} from '@rapidsai/blazingsql';
   *
   * const a  = Series.new({type: new Int32(), data: [1, 2, 3]});
   * const b  = Series.new({type: new Int32(), data: [4, 5, 6]});
   * const df = new DataFrame({'a': a, 'b': b});
   *
   * const bc = new SQLContext();
   * bc.createTable('test_table', df);
   * ```
   */
  public createTable<T extends TypeMap>(tableName: string, input: DataFrame<T>): void {
    callMethodSync(this._db, 'removeTable', tableName);
    this._tables.set(tableName, input);

    const arr = ArrayList();
    input.names.forEach((name: string, index: number) => {
      const dataType =
        callStaticMethodSync('com.blazingdb.calcite.catalog.domain.CatalogColumnDataType',
                             'fromTypeId',
                             input.get(name).type.typeId);
      const column = CatalogColumnImpl([name, dataType, index]);
      callMethodSync(arr, 'add', column);
    });
    const tableJava = CatalogTableImpl([tableName, this._db, arr]);
    callMethodSync(this._db, 'addTable', tableJava);
    this._schema    = BlazingSchema(this._db);
    this._generator = RelationalAlgebraGenerator(this._schema);
  }

  /**
   * Drop a SQL table from SQLContext memory.
   *
   * @param tableName Name of the table to drop
   *
   * @example
   * ```typescript
   * import {Series, DataFrame, Int32} from '@rapidsai/cudf';
   * import {SQLContext} from '@rapidsai/blazingsql';
   *
   * const a  = Series.new({type: new Int32(), data: [1, 2, 3]});
   * const b  = Series.new({type: new Int32(), data: [4, 5, 6]});
   * const df = new DataFrame({'a': a, 'b': b});
   *
   * const bc = new SQLContext();
   * bc.createTable('test_table', df);
   * bc.sql('SELECT a FROM test_table');
   * bc.dropTable('test_table', df);
   * ```
   */
  public dropTable(tableName: string): void {
    if (!this._tables.has(tableName)) {
      throw new Error(`Unable to find table with name ${tableName} to drop from SQLContext memory`);
    }

    callMethodSync(this._db, 'removeTable', tableName);
    this._schema    = BlazingSchema(this._db);
    this._generator = RelationalAlgebraGenerator(this._schema);
    this._tables.delete(tableName);
  }

  /**
   * Returns an array with the names of all created tables.
   *
   * @example
   * ```typescript
   * import {Series, DataFrame, Int32} from '@rapidsai/cudf';
   * import {SQLContext} from '@rapidsai/blazingsql';
   *
   * const a  = Series.new({type: new Int32(), data: [1, 2, 3]});
   * const df = new DataFrame({'a': a});
   *
   * const bc = new SQLContext();
   * bc.createTable('test_table', df);
   * bc.listTables(); // ['test_table']
   * ```
   */
  public listTables(): string[] { return [...this._tables.keys()]; }

  /**
   * Returns a map with column names as keys and the column data type as values.
   *
   * @example
   * ```typescript
   * import {Series, DataFrame, Int32} from '@rapidsai/cudf';
   * import {SQLContext} from '@rapidsai/blazingsql';
   *
   * const a  = Series.new({type: new Int32(), data: [1, 2, 3]});
   * const df = new DataFrame({'a': a});
   *
   * const bc = new SQLContext();
   * bc.createTable('test_table', df);
   * bc.describeTable('test_table'); // {'a': Int32}
   * ```
   */
  public describeTable(tableName: string): Map<string, DataType> {
    const table = this._tables.get(tableName);
    if (table === undefined) { return new Map(); }
    return table.names.reduce(
      (m: Map<string, DataType>, name: string) => m.set(name, table.get(name).type), new Map());
  }

  /**
   * Query a SQL table and return the result as a DataFrame.
   *
   * @param query SQL query string
   * @param ctxToken an optional content token used for communicating multiple nodes
   *
   * @example
   * ```typescript
   * import {Series, DataFrame, Int32} from '@rapidsai/cudf';
   * import {SQLContext} from '@rapidsai/blazingsql';
   *
   * const a  = Series.new({type: new Int32(), data: [1, 2, 3]});
   * const b  = Series.new({type: new Int32(), data: [4, 5, 6]});
   * const df = new DataFrame({'a': a, 'b': b});
   *
   * const bc = new SQLContext();
   * bc.createTable('test_table', df);
   *
   * bc.sql('SELECT a FROM test_table').result(); // [1, 2, 3]
   * ```
   */
  public sql(query: string, ctxToken: number = Math.random() * Number.MAX_SAFE_INTEGER | 0) {
    const algebra = this.explain(query);
    if (algebra == '') { throw new Error('ERROR: Failed to parse given query'); }

    if (algebra.includes('LogicalValues(tuples=[[]])')) {
      // SQL returns an empty execution graph.
      return new ExecutionGraph();
    }

    if (algebra.includes(') OVER (')) {
      console.log(
        'WARNING: Window Functions are currently an experimental feature and not fully supported or tested');
    }

    const tableScanInfo    = getTableScanInfo(algebra);
    const tableNames       = tableScanInfo[0];
    const tableScans       = tableScanInfo[1];
    const d                = new Date();
    const currentTimestamp = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${
      d.getHours()}:${d.getMinutes()}:${d.getSeconds()}.${d.getMilliseconds()}000`;
    const selectedDataFrames: DataFrame[] =
      tableNames.reduce((result: DataFrame[], tableName: string) => {
        const table = this._tables.get(tableName);
        if (table !== undefined) { result.push(table); }
        return result;
      }, []);

    return new ExecutionGraph(this.context.runGenerateGraph(selectedDataFrames,
                                                            tableNames,
                                                            tableScans,
                                                            ctxToken,
                                                            json_plan_py(algebra),
                                                            this._configOptions,
                                                            query,
                                                            currentTimestamp));
  }

  /**
   * Returns a break down of a given query's logical relational algebra plan.
   *
   * @param sql SQL query
   * @param detail if a physical plan should be returned instead
   *
   * @example
   * ```typescript
   * import {Series, DataFrame} from '@rapidsai/cudf';
   * import {SQLContext} from '@rapidsai/blazingsql';
   *
   * const a  = Series.new([1, 2, 3]);
   * const df = new DataFrame({'a': a});
   *
   * const bc = new SQLContext();
   * bc.createTable('test_table', df);
   *
   * bc.explain('SELECT a FROM test_table'); // BindableTableScan(table=[[main, test_table]],
   * aliases=[[a]])
   * ```
   */
  public explain(sql: string, detail = false): string {
    let algebra = '';

    try {
      algebra = callMethodSync(this._generator, 'getRelationalAlgebraString', sql);

      if (detail == true) {
        const ctxToken = Math.random() * Number.MAX_SAFE_INTEGER;
        algebra =
          json_plan_py(runGeneratePhysicalGraph(['self'], ctxToken, json_plan_py(algebra)), 'True');
      }
    } catch (ex) { throw new Error(ex.cause.getMessageSync()); }

    return String(algebra);
  }

  /**
   * Sends a DataFrame to the cache machine.
   *
   * @param id The id of the destination SQLContext
   * @param ctxToken The token associated with the messageId
   * @param messageId The id used to pull the table on the destination SQLContext
   *
   * @example
   * ```typescript
   * import {Series, DataFrame from '@rapidsai/cudf';
   * import {SQLContext} from '@rapidsai/blazingsql';
   *
   * const a  = Series.new([1, 2, 3]);
   * const df = new DataFrame({'a': a});
   *
   * const bc = new SQLContext();
   * bc.send(0, 0, "message_1", df);
   * ```
   */
  public send(id: number, ctxToken: number, messageId: string, df: DataFrame) {
    this.context.send(id, ctxToken, messageId, df);
  }

  /**
   * Returns a DataFrame pulled from the cache machine.
   *
   * @param messageId The message id given when initially sending the DataFrame to the cache
   *
   * @example
   * ```typescript
   * import {Series, DataFrame from '@rapidsai/cudf';
   * import {SQLContext} from '@rapidsai/blazingsql';
   *
   * const a  = Series.new([1, 2, 3]);
   * const df = new DataFrame({'a': a});
   *
   * const bc = new SQLContext();
   * bc.send(0, 0, "message_1", df);
   * await bc.pull("message_1"); // [1, 2, 3]
   * ```
   */
  async pull(messageId: string) {
    const {names, table} = await this.context.pull(messageId);
    return new DataFrame(names.reduce(
      (cols, name, i) => ({...cols, [name]: Series.new(table.getColumnByIndex(i))}), {}));
  }
}
