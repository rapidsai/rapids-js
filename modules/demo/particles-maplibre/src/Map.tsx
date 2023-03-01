// Copyright (c) 2023, NVIDIA CORPORATION.
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

import maplibregl from 'maplibre-gl';
import React, { useEffect, useRef } from 'react';

type Props = {
  updateTransform: (target: maplibregl.Map) => void;
  mapReady: (event: any) => void; // Replace `any` with the appropriate type
};

function Map({ updateTransform, mapReady }: Props): JSX.Element {
  const mapContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainer.current!,
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      center: [-105, 40],
      zoom: 5,
      dragPan: true,
      scrollZoom: true,
    });

    map.on('move', function (e) {
      updateTransform(e.target);
    });

    map.on('load', function (e) {
      updateTransform(e.target);
      mapReady(e);
    });

    map.on('resize', function (e) {
      updateTransform(e.target);
    });

    return () => {
      map.remove();
    };
  }, []);

  return <div id='map' ref={mapContainer} className='map-container' />;
}

export default Map;