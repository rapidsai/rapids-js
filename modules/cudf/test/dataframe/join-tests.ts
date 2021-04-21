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

import {setDefaultAllocator} from '@nvidia/cuda';
import {DataFrame, Int32, Series} from '@rapidsai/cudf';
import {DeviceBuffer} from '@rapidsai/rmm';

setDefaultAllocator((byteLength: number) => new DeviceBuffer(byteLength));

const left = new DataFrame({
  a: Series.new({type: new Int32, data: [1, 2, 3, 4, 5]}),
  b: Series.new({type: new Int32, data: [0, 0, 1, 1, 2]})
});

const right = new DataFrame({
  b: Series.new({type: new Int32, data: [0, 1, 3]}),
  c: Series.new({type: new Int32, data: [0, 10, 30]})
});

const right_conflict = new DataFrame({
  b: Series.new({type: new Int32, data: [0, 1, 3]}),
  a: Series.new({type: new Int32, data: [0, 10, 30]})
});

describe('DataFrame.join({how="inner"}) ', () => {
  test('can join with no column name conflicts', () => {
    const result = left.join({other: right, on: ['b'], how: 'inner'});
    expect(result.numColumns).toEqual(3);
    expect(result.names).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    expect([...result.get('b')]).toEqual([0, 0, 1, 1]);
    expect([...result.get('a')]).toEqual([1, 2, 3, 4]);
    expect([...result.get('c')]).toEqual([0, 0, 10, 10]);
  });

  test('discards right conflicts without suffices', () => {
    const result = left.join({other: right_conflict, on: ['b'], how: 'inner'});
    expect(result.numColumns).toEqual(2);
    expect(result.names).toEqual(expect.arrayContaining(['a', 'b']));
    expect([...result.get('b')]).toEqual([0, 0, 1, 1]);
    expect([...result.get('a')]).toEqual([1, 2, 3, 4]);
  });

  test('applies lsuffix', () => {
    const result = left.join({other: right_conflict, on: ['b'], how: 'inner', lsuffix: '_L'});
    expect(result.numColumns).toEqual(3);
    expect(result.names).toEqual(expect.arrayContaining(['a', 'b', 'a_L']));
    expect([...result.get('b')]).toEqual([0, 0, 1, 1]);
    expect([...result.get('a_L')]).toEqual([1, 2, 3, 4]);
    expect([...result.get('a')]).toEqual([0, 0, 10, 10]);
  });

  test('applies rsuffix', () => {
    const result = left.join({other: right_conflict, on: ['b'], how: 'inner', rsuffix: '_R'});
    expect(result.numColumns).toEqual(3);
    expect(result.names).toEqual(expect.arrayContaining(['a', 'b', 'a_R']));
    expect([...result.get('b')]).toEqual([0, 0, 1, 1]);
    expect([...result.get('a')]).toEqual([1, 2, 3, 4]);
    expect([...result.get('a_R')]).toEqual([0, 0, 10, 10]);
  });

  test('applies lsuffix and rsuffix', () => {
    const result =
      left.join({other: right_conflict, on: ['b'], how: 'inner', lsuffix: '_L', rsuffix: '_R'});
    expect(result.numColumns).toEqual(3);
    expect(result.names).toEqual(expect.arrayContaining(['a_L', 'b', 'a_R']));
    expect([...result.get('b')]).toEqual([0, 0, 1, 1]);
    expect([...result.get('a_L')]).toEqual([1, 2, 3, 4]);
    expect([...result.get('a_R')]).toEqual([0, 0, 10, 10]);
  });
});

describe('DataFrame.join({how="left"}) ', () => {
  test('can join with no column name conflicts', () => {
    const result = left.join({other: right, on: ['b'], how: 'left'});
    expect(result.numColumns).toEqual(3);
    expect(result.names).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    expect([...result.get('b')]).toEqual([0, 0, 1, 1, 2]);
    expect([...result.get('a')]).toEqual([1, 2, 3, 4, 5]);
    expect([...result.get('c')]).toEqual([0, 0, 10, 10, null]);
  });

  test('discards right conflicts without suffices', () => {
    const result = left.join({other: right_conflict, on: ['b'], how: 'left'});
    expect(result.numColumns).toEqual(2);
    expect(result.names).toEqual(expect.arrayContaining(['a', 'b']));
    expect([...result.get('b')]).toEqual([0, 0, 1, 1, 2]);
    expect([...result.get('a')]).toEqual([1, 2, 3, 4, 5]);
  });

  test('applies lsuffix', () => {
    const result = left.join({other: right_conflict, on: ['b'], how: 'left', lsuffix: '_L'});
    expect(result.numColumns).toEqual(3);
    expect(result.names).toEqual(expect.arrayContaining(['a', 'b', 'a_L']));
    expect([...result.get('b')]).toEqual([0, 0, 1, 1, 2]);
    expect([...result.get('a_L')]).toEqual([1, 2, 3, 4, 5]);
    expect([...result.get('a')]).toEqual([0, 0, 10, 10, null]);
  });

  test('applies rsuffix', () => {
    const result = left.join({other: right_conflict, on: ['b'], how: 'left', rsuffix: '_R'});
    expect(result.numColumns).toEqual(3);
    expect(result.names).toEqual(expect.arrayContaining(['a', 'b', 'a_R']));
    expect([...result.get('b')]).toEqual([0, 0, 1, 1, 2]);
    expect([...result.get('a')]).toEqual([1, 2, 3, 4, 5]);
    expect([...result.get('a_R')]).toEqual([0, 0, 10, 10, null]);
  });

  test('applies lsuffix and rsuffix', () => {
    const result =
      left.join({other: right_conflict, on: ['b'], how: 'left', lsuffix: '_L', rsuffix: '_R'});
    expect(result.numColumns).toEqual(3);
    expect(result.names).toEqual(expect.arrayContaining(['a_L', 'b', 'a_R']));
    expect([...result.get('b')]).toEqual([0, 0, 1, 1, 2]);
    expect([...result.get('a_L')]).toEqual([1, 2, 3, 4, 5]);
    expect([...result.get('a_R')]).toEqual([0, 0, 10, 10, null]);
  });
});

describe('DataFrame.join({how="outer"}) ', () => {
  test('can join with no column name conflicts', () => {
    const result = left.join({other: right, on: ['b'], how: 'outer'});
    expect(result.numColumns).toEqual(3);
    expect(result.names).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    expect([...result.get('b')]).toEqual([0, 0, 1, 1, 2, 3]);
    expect([...result.get('a')]).toEqual([1, 2, 3, 4, 5, null]);
    expect([...result.get('c')]).toEqual([0, 0, 10, 10, null, 30]);
  });
  test('discards right conflicts without suffices', () => {
    const result = left.join({other: right_conflict, on: ['b'], how: 'outer'});
    expect(result.numColumns).toEqual(2);
    expect(result.names).toEqual(expect.arrayContaining(['a', 'b']));
    expect([...result.get('b')]).toEqual([0, 0, 1, 1, 2, 3]);
    expect([...result.get('a')]).toEqual([1, 2, 3, 4, 5, null]);
  });

  test('applies lsuffix', () => {
    const result = left.join({other: right_conflict, on: ['b'], how: 'outer', lsuffix: '_L'});
    expect(result.numColumns).toEqual(3);
    expect(result.names).toEqual(expect.arrayContaining(['a', 'b', 'a_L']));
    expect([...result.get('b')]).toEqual([0, 0, 1, 1, 2, 3]);
    expect([...result.get('a_L')]).toEqual([1, 2, 3, 4, 5, null]);
    expect([...result.get('a')]).toEqual([0, 0, 10, 10, null, 30]);
    
  });

  test('applies rsuffix', () => {
    const result = left.join({other: right_conflict, on: ['b'], how: 'outer', rsuffix: '_R'});
    expect(result.numColumns).toEqual(3);
    expect(result.names).toEqual(expect.arrayContaining(['a', 'b', 'a_R']));
    expect([...result.get('b')]).toEqual([0, 0, 1, 1, 2, 3]);
    expect([...result.get('a')]).toEqual([1, 2, 3, 4, 5, null]);
    expect([...result.get('a_R')]).toEqual([0, 0, 10, 10, null, 30]);
  });

  test('applies lsuffix and rsuffix', () => {
    const result =
      left.join({other: right_conflict, on: ['b'], how: 'outer', lsuffix: '_L', rsuffix: '_R'});
    expect(result.numColumns).toEqual(3);
    expect(result.names).toEqual(expect.arrayContaining(['a_L', 'b', 'a_R']));
    expect([...result.get('b')]).toEqual([0, 0, 1, 1, 2, 3]);
    expect([...result.get('a_L')]).toEqual([1, 2, 3, 4, 5, null]);
    expect([...result.get('a_R')]).toEqual([0, 0, 10, 10, null, 30]);
  });
});

describe('DataFrame.join({how="right"}) ', () => {
  test('can join with no column name conflicts', () => {
    const result = left.join({other: right, on: ['b'], how: 'right'});
    expect(result.numColumns).toEqual(3);
    expect(result.names).toEqual(expect.arrayContaining(['a', 'b', 'c']));

    // sort order?
    expect([...result.get('b')]).toEqual([0, 1, null, 0, 1]);
    expect([...result.get('a')]).toEqual([1, 3, null, 2, 4]);
    expect([...result.get('c')]).toEqual([0, 10, 30, 0, 10]);
  });
});
