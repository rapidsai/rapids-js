// Copyright (c) 2022-2023, NVIDIA CORPORATION.
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

type State = {
  isHeld: boolean;
  zoomLevel: number;
  angle: number;
  mapReady: boolean;
  map: any; // Replace `any` with the appropriate type
  pointOffset: number;
};

type Action =
  | { type: 'MOUSE_CLICK', event: MouseEvent }
  | { type: 'MOUSE_RELEASE', event: MouseEvent }
  | { type: 'SCROLL', event: WheelEvent }
  | { type: 'ROTATE' }
  | { type: 'UPDATE_TRANSFORM', event: any } // Replace `any` with the appropriate type
  | { type: 'MAP_READY', event: any } // Replace `any` with the appropriate type
  | { type: 'UPDATE_POINTOFFSET', event: any }; // Replace `any` with the appropriate type

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'MOUSE_CLICK':
      console.log('click');
      console.log(state);
      return { ...state, isHeld: true };
    case 'MOUSE_RELEASE':
      console.log('unclick');
      return { ...state, isHeld: false };
    case 'SCROLL':
      console.log('scroll');
      const zoom = action.event.deltaY > 0 ? -1 : 1;
      const result = action.event.deltaY > 0 ? state.zoomLevel / 1.2 : state.zoomLevel * 1.2;
      return { ...state, zoomLevel: result };
    case 'ROTATE':
      const angle = state.angle;
      return { ...state, angle: (angle + 1) % 360 };
    case 'UPDATE_TRANSFORM':
      console.log('update transform...');
      console.log(action.event);
      return { ...state, map: action.event };
    case 'MAP_READY':
      console.log('map ready');
      console.log(action.event);
      return { ...state, mapReady: true, map: action.event.target };
    case 'UPDATE_POINTOFFSET':
      console.log('point offset updated');
      console.log(action.event);
      return { ...state, mapReady: true, pointOffset: action.event };
    default:
      throw new Error('chalupa batman');
  }
};

export default reducer;