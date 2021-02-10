// Copyright (c) 2020, NVIDIA CORPORATION.
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

import {Float32Buffer, Int32Buffer, setDefaultAllocator, Uint8Buffer} from '@nvidia/cuda';
import {Bool8, DataFrame, Float32, Int32, NullOrder, Series} from '@nvidia/cudf';
import {CudaMemoryResource, DeviceBuffer} from '@nvidia/rmm';
import {BoolVector} from 'apache-arrow'

const mr = new CudaMemoryResource();

setDefaultAllocator((byteLength: number) => new DeviceBuffer(byteLength, mr));

test('DataFrame initialization', () => {
  const length = 100;
  const col_0  = Series.new({type: new Int32(), data: new Int32Buffer(length)});

  const col_1   = Series.new({
    type: new Bool8(),
    data: new Uint8Buffer(length),
    nullMask: new Uint8Buffer(64),
  });
  const table_0 = new DataFrame({"col_0": col_0, "col_1": col_1});
  expect(table_0.numColumns).toBe(2);
  expect(table_0.numRows).toBe(length);
  expect(table_0.names).toStrictEqual(['col_0', 'col_1']);
  expect(table_0.get("col_0").type.typeId).toBe(col_0.type.typeId);
  expect(table_0.get("col_1").type.typeId).toBe(col_1.type.typeId);
});

test('DataFrame.get', () => {
  const length = 100;
  const col_0  = Series.new({type: new Int32(), data: new Int32Buffer(length)});

  const col_1   = Series.new({
    type: new Bool8(),
    data: new Uint8Buffer(length),
    nullMask: new Uint8Buffer(64),
  });
  const table_0 = new DataFrame({"col_0": col_0, "col_1": col_1});
  expect(table_0.get("col_0").type.typeId).toBe(col_0.type.typeId);
  expect(() => { (<any>table_0).get(2); }).toThrow();
  expect(() => { (<any>table_0).get("junk"); }).toThrow();
});

test('DataFrame.select', () => {
  const length = 100;
  const col_0  = Series.new({type: new Int32(), data: new Int32Buffer(length)});

  const col_1 = Series.new({
    type: new Bool8(),
    data: new Uint8Buffer(length),
    nullMask: new Uint8Buffer(64),
  });

  const col_2 = Series.new({type: new Int32(), data: new Int32Buffer(length)});
  const col_3 = Series.new({type: new Int32(), data: new Int32Buffer(length)});

  const table_0 = new DataFrame({"col_0": col_0, "col_1": col_1, "col_2": col_2, "col_3": col_3});

  expect(table_0.numColumns).toBe(4);
  expect(table_0.numRows).toBe(length);
  expect(table_0.names).toStrictEqual(["col_0", "col_1", "col_2", "col_3"]);

  expect(table_0.select(["col_0"])).toStrictEqual(new DataFrame({"col_0": col_0}));
  expect(table_0.select(["col_0", "col_3"]))
    .toStrictEqual(new DataFrame({"col_0": col_0, "col_3": col_3}));
});

test('DataFrame.assign', () => {
  const length = 100;
  const col_0  = Series.new({type: new Int32(), data: new Int32Buffer(length)});

  const col_1 = Series.new({
    type: new Bool8(),
    data: new Uint8Buffer(length),
    nullMask: new Uint8Buffer(64),
  });

  const col_2 = Series.new({type: new Int32(), data: new Int32Buffer(length)});
  const col_3 = Series.new({type: new Int32(), data: new Int32Buffer(length)});

  const table_0 = new DataFrame({"col_0": col_0, "col_1": col_1, "col_2": col_2});

  const table_1 = table_0.assign({"col_3": col_3});
  expect(table_1.numColumns).toBe(4);
  expect(table_1.numRows).toBe(length);
  expect(table_1.names).toStrictEqual(["col_0", "col_1", "col_2", "col_3"]);
});

test('DataFrame.drop', () => {
  const length = 100;
  const col_0  = Series.new({type: new Int32(), data: new Int32Buffer(length)});

  const col_1 = Series.new({
    type: new Bool8(),
    data: new Uint8Buffer(length),
    nullMask: new Uint8Buffer(64),
  });

  const col_2 = Series.new({type: new Int32(), data: new Int32Buffer(length)});

  const table_0 = new DataFrame({"col_0": col_0, "col_1": col_1, "col_2": col_2});

  const table_1 = table_0.drop(["col_1"]);
  expect(table_1.numColumns).toBe(2);
  expect(table_1.numRows).toBe(length);
  expect(table_1.names).toStrictEqual(["col_0", "col_2"]);
});

test('DataFrame.orderBy (ascending, non-null)', () => {
  const col    = Series.new({type: new Int32(), data: new Int32Buffer([1, 3, 5, 4, 2, 0])});
  const df     = new DataFrame({"a": col});
  const result = df.orderBy({"a": {ascending: true, null_order: NullOrder.BEFORE}});

  const expected = [5, 0, 4, 1, 3, 2];
  expect([...result.toArrow()]).toEqual([...Buffer.from(expected)])
});

test('DataFrame.orderBy (descending, non-null)', () => {
  const col    = Series.new({type: new Int32(), data: new Int32Buffer([1, 3, 5, 4, 2, 0])});
  const df     = new DataFrame({"a": col});
  const result = df.orderBy({"a": {ascending: false, null_order: NullOrder.BEFORE}});

  const expected = [2, 3, 1, 4, 0, 5];
  expect([...result.toArrow()]).toEqual([...Buffer.from(expected)])
});

test('DataFrame.orderBy (ascending, null before)', () => {
  const mask = new Uint8Buffer(BoolVector.from([1, 0, 1, 1, 1, 1]).values);
  const col =
    Series.new({type: new Int32(), data: new Int32Buffer([1, 3, 5, 4, 2, 0]), nullMask: mask});
  const df     = new DataFrame({"a": col});
  const result = df.orderBy({"a": {ascending: true, null_order: NullOrder.BEFORE}});

  const expected = [1, 5, 0, 4, 3, 2];
  expect([...result.toArrow()]).toEqual([...Buffer.from(expected)])
});

test('DataFrame.orderBy (ascending, null after)', () => {
  const mask = new Uint8Buffer(BoolVector.from([1, 0, 1, 1, 1, 1]).values);
  const col =
    Series.new({type: new Int32(), data: new Int32Buffer([1, 3, 5, 4, 2, 0]), nullMask: mask});
  const df     = new DataFrame({"a": col});
  const result = df.orderBy({"a": {ascending: true, null_order: NullOrder.AFTER}});

  const expected = [5, 0, 4, 3, 2, 1];
  expect([...result.toArrow()]).toEqual([...Buffer.from(expected)])
});

test('DataFrame.orderBy (descendng, null before)', () => {
  const mask = new Uint8Buffer(BoolVector.from([1, 0, 1, 1, 1, 1]).values);
  const col =
    Series.new({type: new Int32(), data: new Int32Buffer([1, 3, 5, 4, 2, 0]), nullMask: mask});
  const df     = new DataFrame({"a": col});
  const result = df.orderBy({"a": {ascending: false, null_order: NullOrder.BEFORE}});

  const expected = [2, 3, 4, 0, 5, 1];

  expect([...result.toArrow()]).toEqual([...Buffer.from(expected)])
});

test('DataFrame.orderBy (descending, null after)', () => {
  const mask = new Uint8Buffer(BoolVector.from([1, 0, 1, 1, 1, 1]).values);
  const col =
    Series.new({type: new Int32(), data: new Int32Buffer([1, 3, 5, 4, 2, 0]), nullMask: mask});
  const df     = new DataFrame({"a": col});
  const result = df.orderBy({"a": {ascending: false, null_order: NullOrder.AFTER}});

  const expected = [1, 2, 3, 4, 0, 5];
  expect([...result.toArrow()]).toEqual([...Buffer.from(expected)])
});

test('DataFrame.gather (indices)', () => {
  const a = Series.new({type: new Int32(), data: new Int32Buffer([0, 1, 2, 3, 4, 5])});
  const b =
    Series.new({type: new Float32(), data: new Float32Buffer([0.0, 1.0, 2.0, 3.0, 4.0, 5.0])});
  const df = new DataFrame({"a": a, "b": b});

  const selection = Series.new({type: new Int32(), data: new Int32Buffer([2, 4, 5])});

  const result = df.gather(selection);
  expect(result.numRows).toBe(3);

  const ra = result.get("a");
  const rb = result.get("b");

  const expected_a = Series.new({type: new Int32(), data: new Int32Buffer([2, 4, 5])});
  expect([...ra.toArrow()]).toEqual([...expected_a.toArrow()]);

  const expected_b = Series.new({type: new Float32(), data: new Float32Buffer([2.0, 4.0, 5.0])});
  expect([...rb.toArrow()]).toEqual([...expected_b.toArrow()]);
});

test('Series.filter', () => {
  const a = Series.new({type: new Int32(), data: new Int32Buffer([0, 1, 2, 3, 4, 5])});
  const b =
    Series.new({type: new Float32(), data: new Float32Buffer([0.0, 1.0, 2.0, 3.0, 4.0, 5.0])});
  const df = new DataFrame({"a": a, "b": b});

  const mask =
    Series.new({length: 6, type: new Bool8(), data: new Uint8Buffer([0, 0, 1, 0, 1, 1])});

  const result = df.filter(mask);
  expect(result.numRows).toBe(3);

  const ra = result.get("a");
  const rb = result.get("b");

  const expected_a = Series.new({type: new Int32(), data: new Int32Buffer([2, 4, 5])});
  expect([...ra.toArrow()]).toEqual([...expected_a.toArrow()]);

  const expected_b = Series.new({type: new Float32(), data: new Float32Buffer([2.0, 4.0, 5.0])});
  expect([...rb.toArrow()]).toEqual([...expected_b.toArrow()]);
});

test('dataframe.dropNulls(axis=0)',
     () => {
       const mask = new Uint8Buffer(BoolVector.from([1, 0, 1, 1, 1, 1]).values);
       const a =
         Series.new({type: new Int32, data: new Int32Buffer([0, 1, 2, 3, 4, 4]), nullMask: mask});
       const b = Series.new({type: new Float32, data: new Float32Buffer([0, 2, 3, 5, 5, 6])});

       const df = new DataFrame({"a": a, "b": b});

       const expected_a = Series.new({type: new Int32, data: new Int32Buffer([0, 2, 3, 4, 4])});
       const expected_b = Series.new({type: new Float32, data: new Float32Buffer([0, 3, 5, 5, 6])});

       const result = df.dropNulls() as DataFrame;  // axis=0, inplace=false
       const ra     = result.get("a");
       const rb     = result.get("b");

       expect([...ra.toArrow()]).toEqual([...expected_a.toArrow()]);
       expect([...rb.toArrow()]).toEqual([...expected_b.toArrow()]);
     })

  // test('dataframe.dropNulls(axis=1)', () => {
  //   const mask = new Uint8Buffer(BoolVector.from([1, 0, 1, 1, 1, 1]).values);
  //   const a = Series.new({type: new Int32, data: new Int32Buffer([0, 1, 2, 3, 4, 4]),
  //   nullMask:mask}); const b = Series.new({type: new Float32, data: new Float32Buffer([0, 2, 3,
  //   5, 5, 6])});

  //   const df = new DataFrame({"col_0":a, "col_1": b});

  //   const expected_a = Series.new({type: new Int32(), data: new Int32Buffer([0, 2, 3, 4, 4])});
  //   const expected_b = Series.new({type: new Float32, data: new Float32Buffer([0, 3, 5, 5, 6])});

  //   const result = df.dropNulls(0) as DataFrame; //axis=0, inplace=false
  //   const ra = result.get("a");
  //   const rb = result.get("b");

  //   expect([...ra.toArrow()]).toEqual([...expected_a.toArrow()]);
  //   expect([...rb.toArrow()]).toEqual([...expected_b.toArrow()]);
  // })
