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

const wrtc                       = require('wrtc');
const {MemoryView}               = require('@rapidsai/cuda');
const {Series, Int32, DataFrame} = require('@rapidsai/cudf');

const {RenderCluster} = require('../../render/cluster');

const {create: shmCreate, detach: shmDetach} = require('shm-typed-array');

module.exports         = graphSSRClients;
module.exports.graphs  = Symbol('graphs');
module.exports.clients = Symbol('clients');

/**
 *
 * @param {import('fastify').FastifyInstance} fastify
 */
function graphSSRClients(fastify) {
  const graphs  = Object.create(null);
  const clients = Object.create(null);

  fastify.decorate(module.exports.graphs, graphs);
  fastify.decorate(module.exports.clients, clients);

  setInterval(layoutAndRenderGraphs(clients));

  return {onConnect, onData, onClose, onError: onClose};

  async function onConnect(sock, peer) {
    const {
      width      = 800,
      height     = 600,
      layout     = true,
      g: graphId = 'default',
    } = sock?.handshake?.query || {};

    const stream = new wrtc.MediaStream({id: `${sock.id}:video`});
    const source = new wrtc.nonstandard.RTCVideoSource({});

    clients[stream.id] = {
      video: source,
      state: {
        pickingMode: 'click',  // 'click', 'boxSelect'
        selectedInfo: {},
        boxSelectCoordinates: {rectdata: [{polygon: [[]], show: false}], startPos: null},
        clearSelections: false
      },
      event: {},
      props: {width, height, layout},
      graph: {},  // await loadGraph(graphId),
      data: {
        nodes: {dataframe: new DataFrame({}), color: '', size: '', id: '', x: 'x', y: 'y'},
        edges: {dataframe: new DataFrame({}), color: '', id: '', bundle: '', src: 'src', dst: 'dst'}
      },
      frame: shmCreate(width * height * 3 / 2),
      peer: peer,
    };

    // if (clients[stream.id].graph !== {}) {
    //   if (clients[stream.id].graph.dataframes[0]) {
    //     const res = getPaginatedRows(clients[stream.id].graph.dataframes[0]);
    //     peer.send(JSON.stringify({
    //       type: 'data',
    //       data: {nodes: {data: res, length: clients[stream.id].graph.dataframes[0].numRows}}
    //     }));
    //   }
    //   if (clients[stream.id].graph.dataframes[1]) {
    //     const res = getPaginatedRows(clients[stream.id].graph.dataframes[1]);
    //     peer.send(JSON.stringify({
    //       type: 'data',
    //       data: {edges: {data: res, length: clients[stream.id].graph.dataframes[1].numRows}}
    //     }));
    //   }
    // }

    stream.addTrack(source.createTrack());
    peer.streams.push(stream);
    peer.addStream(stream);
  }

  function onData(sock, peer, message) {
    const [stream] = peer?.streams || [];
    if (stream && !peer.destroyed && !peer.destroying) {
      const {type, data} = (() => {
        try {
          return JSON.parse('' + message);
        } catch (e) { return {}; }
      })();
      switch (data && type) {
        case 'event': {
          clients[stream.id].event[data.type] = data;
          break;
        }
        case 'pickingMode': {
          clients[stream.id].state.pickingMode = data;
          break;
        }
        case 'clearSelections': {
          clients[stream.id].state.clearSelections = JSON.parse(data);
          break;
        }
        case 'layout': {
          clients[stream.id].props.layout = JSON.parse(data);
          console.log(JSON.parse(data));
          break;
        }
      }
    }
  }

  function onClose(sock, peer) {
    const [stream] = peer?.streams || [];
    if (stream) { delete clients[stream.id]; }
    const {g: graphId = 'default'} = sock?.handshake?.query || {};
    if (graphId in graphs) {
      if ((graphs[graphId].refCount -= 1) === 0) {  //
        delete graphs[graphId];
      }
    }
  }
}

function layoutAndRenderGraphs(clients) {
  const renderer = new RenderCluster({numWorkers: 1 && 4});

  return () => {
    for (const id in clients) {
      const client = clients[id];
      const sendToClient =
        ([nodes, edges]) => {
          client.peer.send(JSON.stringify(
            {type: 'data', data: {nodes: {data: getPaginatedRows(nodes), length: nodes.numRows}}}));
          client.peer.send(JSON.stringify(
            {type: 'data', data: {edges: {data: getPaginatedRows(edges), length: edges.numRows}}}));
        }

      if (client.isRendering) {
        continue;
      }

      if (client.graph == {}) { continue; }

      const state = {...client.state};
      const props = {...client.props};
      const event =
        [
          'focus',
          'blur',
          'keydown',
          'keypress',
          'keyup',
          'mouseenter',
          'mousedown',
          'mousemove',
          'mouseup',
          'mouseleave',
          'wheel',
          'beforeunload',
          'shiftKey',
          'dragStart',
          'dragOver'
        ].map((x) => client.event[x])
          .filter(Boolean);

      if (event.length === 0 && !props.layout) { continue; }
      if (event.length !== 0) { client.event = Object.create(null); }
      if (props.layout == true && client.graph !== {}) { client.graph = forceAtlas2(client.graph); }

      const {
        width  = client.props.width ?? 800,
        height = client.props.height ?? 600,
      } = client.state;

      state.window = {width: width, height: height, ...client.state.window};

      if (client.frame?.byteLength !== (width * height * 3 / 2)) {
        shmDetach(client.frame.key, true);
        client.frame = shmCreate(width * height * 3 / 2);
      }
      client.isRendering = true;

      renderer.render(
        id,
        {
          state,
          props,
          event,
          frame: client.frame.key,
          graph: {
            ...client.graph,
            graph: undefined,
            edges: getIpcHandles(client.graph.edges),
            nodes: getIpcHandles(client.graph.nodes),
          },
        },
        (error, result) => {
          client.isRendering = false;
          if (id in clients) {
            if (error) { throw error; }
            if (client.state.clearSelections == true) {
              // clear selection is called once
              result.state.clearSelections = false;

              // reset selected state
              result.state.selectedInfo.selectedNodes       = [];
              result.state.selectedInfo.selectedEdges       = [];
              result.state.selectedInfo.selectedCoordinates = {};
              result.state.boxSelectCoordinates.rectdata    = [{polygon: [[]], show: false}];

              // send to client
              sendToClient([client.data.nodes.dataframe, client.data.edges.dataframe]);
            } else if (JSON.stringify(client.state.selectedInfo.selectedCoordinates) !==
                       JSON.stringify(result.state.selectedInfo.selectedCoordinates)) {
              // selections updated
              const nodes =
                Series.new({type: new Int32, data: result.state.selectedInfo.selectedNodes});
              const edges =
                Series.new({type: new Int32, data: result.state.selectedInfo.selectedEdges});
              sendToClient([
                client.data.nodes.dataframe.gather(nodes),
                client.data.edges.dataframe.gather(edges)
              ]);
            }
            // copy result state to client's current state
            result?.state && Object.assign(client.state, result.state);

            client.video.onFrame({...result.frame, data: client.frame.buffer});
          }
        });
    }
  }
}

function getPaginatedRows(df, page = 1, rowsPerPage = 400) {
  if (!df) { return {}; }
  return df.head(page * rowsPerPage).tail(rowsPerPage).toArrow().toArray();
}

function forceAtlas2({graph, nodes, edges, ...params}) {
  if (graph == undefined) { return {}; }
  graph.forceAtlas2({...params, positions: nodes.nodeXPositions.buffer});
  return {
    graph,
    ...params,
    nodes: {...nodes, length: graph.numNodes()},
    edges: {...edges, length: graph.numEdges()},
  };
}

function getIpcHandles(obj) {
  const res = {};
  for (const key in obj) {
    const val = obj[key];
    res[key]  = val;
    if (val && (val instanceof MemoryView)) {  //
      try {
        res[key] = val.getIpcHandle().toJSON();
      } catch (e) {
        throw new Error([
          `Failed to get IPC handle for "${key}" buffer`,
          ...(e || '').toString().split('\n').map((x) => `\t${x}`)
        ].join('\n'));
      }
    }
  }
  return res;
}
