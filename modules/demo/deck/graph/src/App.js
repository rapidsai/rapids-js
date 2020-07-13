/* eslint-disable */


import React from 'react';
import DeckGL from '@deck.gl/react';
import { StaticMap } from 'react-map-gl';
import { COORDINATE_SYSTEM } from '@deck.gl/core';
import { PointsLayer } from './layers/points-layer';
import { Table, RecordBatchReader } from 'apache-arrow';
import { GeoJsonLayer, PolygonLayer } from '@deck.gl/layers';

// import { log as deckLog } from '@deck.gl/core';
// import { log as lumaLog } from '@luma.gl/core';
// lumaLog.level = 3;
// deckLog.level = 3;

// const MAPBOX_TOKEN = 'pk.eyJ1Ijoid21qcGlsbG93IiwiYSI6ImNrN2JldzdpbDA2Ym0zZXFzZ3oydXN2ajIifQ.qPOZDsyYgMMUhxEKrvHzRA'; // eslint-disable-line

// Source data GeoJSON
// const DATA_URL = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json';

const INITIAL_VIEW_STATE = {
    longitude: -98.35,
    latitude: 39.50,
    zoom: 3,
    // minZoom: 0,
    // maxZoom: 20,
    pitch: 0,
    bearing: 0,
};
 

const landCover = [[[-123.0, 49.196], [-123.0, 49.324], [-123.306, 49.324], [-123.306, 49.196]]];

export default class App extends React.Component {
    constructor(...args) {
        super(...args);
        this.state = { chunks: [] };
    }
    componentDidMount() {
        (async () => {
            // You can increase or decrease this number from 0-1000
            for await (const chunk of loadGraphData(1000)) {
                this.setState({ chunks: [...this.state.chunks, chunk] });
                // console.log(chunk);
            }
        })();
    }
    _renderLayers() {
        const {data = DATA_URL} = this.props;
        return [
            new PointsLayer({
                id: 'points',
                // this is used as a divisor in the shader, i.e. `age/radiusScale`
                radiusScale: 120,
                radiusMinPixels: 0.1,
                radiusMaxPixels: 10,
                chunks: this.state.chunks,
                elements: this.state.elements,
                coordinateOrigin: [1, 0],
                // coordinateOrigin: [2 / 29, -1 / 27.5, 0.0],
                coordinateSystem: COORDINATE_SYSTEM.METER_OFFSETS,
            }),
        ];
    }
    render() {
        const { mapStyle = 'mapbox://styles/mapbox/dark-v9' } = this.props;
        return (
            <DeckGL
                controller={true}
                layers={this._renderLayers()}
                initialViewState={INITIAL_VIEW_STATE}
                style={{ backgroundColor: '#2e2e2e' }}
                onWebGLInitialized={(gl) => {
                    if (gl.opengl) {
                        gl.enable(gl.PROGRAM_POINT_SIZE);
                        gl.enable(gl.POINT_SPRITE);
                    }
                }}>
            </DeckGL>
        );
    }
};

async function* loadGraphData(maxNumBatches = Number.POSITIVE_INFINITY) {

    let chunks = [];
    let recordBatchIndex = 0;
    let numBufferedNodes = 0;
    let bufferedByteLength = 0;

    let controller = null;
    const batches = await (async () => {
        if (WebGL2RenderingContext.prototype.opengl) {
            return await RecordBatchReader.from(require('fs')
                .createReadStream('./public/data/01032018-webgl-nodes-small.arrow'));
        }
        controller = new AbortController();
        const response = await fetch(`${process.env.PUBLIC_URL}/data/01032018-webgl-nodes-small.arrow`, {
            mode: 'cors',
            cache: 'no-store',
            credentials: 'omit',
            signal: controller.signal,
            headers: {
                'pragma': 'no-cache',
                'cache-control': 'no-store'
            },
        });
        return await RecordBatchReader.from(response.body);
    })();

    const combineChunks = (chunks) => {
        // construct a Table from each of the chunks
        const table = new Table(chunks);
        // toArray() will create a single contiguous temporary buffer
        // for all the data across all of the chunks we've cached so far
        return {
            length: table.length,
            // x: table.getChildAt(0).toArray(),
            // y: table.getChildAt(1).toArray(),
        };
    };

    for await (const batch of batches) {
        numBufferedNodes += batch.length;

        // Only buffer until we reach deck.gl's limit for the size of its picking buffers
        if (numBufferedNodes >= (16777215 / 3)) {
            yield combineChunks(chunks);
            chunks = [];
            numBufferedNodes = 0;
            bufferedByteLength = 0;
        }

        // (
        //     `received batch ${recordBatchIndex
        //     } size=${batch.byteLength
        //     } bytes (${batch.byteLength / (1024 ** 2)
        //     } MiB)`
        // );

        chunks.push(batch);
        // console.log(batch.data.childData);
        bufferedByteLength += batch.byteLength;

        if (++recordBatchIndex >= maxNumBatches) {
            controller && controller.abort();
            break;
        }
    }

    // Render any leftover chunks
    if (chunks.length > 0) {
        yield combineChunks(chunks);
    }
}
