import './App.css';

import React, {useEffect} from 'react';

import Controls from './Controls.js';
import ErrorBoundary from './ErrorBoundary.jsx';
import Map from './Map.js';
import Particles from './Particles.jsx';
import reducer from './Reducer';
import Title from './Title.js';

/*
  Homogeneous coordinates for projection matrix
  Projecting from one 2d basis to another using control points
  requires 3 3d coordinates in order to capture translation in
  the projection matrix. OpenGL is a 3d system with a 4d
  homogeneous matrix patter. We'll use mat4 to do 4d matrix
  transformations on our 2d points. Throw away the third dimension
  and keep the homogeneous coordinate.

  These will be used in props to align the screen and world coordinate
  systems.
*/
const worldCoords = [
  -137.3,
  49.2,  // top right
  0,
  1,
  -61.6,
  49.2,  // top left
  0,
  1,
  -61.6,
  25.2,  // bottom left
  0,
  1,
  -137.3,
  25.2,  // bottom right
  0,
  1
];
/*
 Screen coords matching the axes of the above worldCoords. They are used to
 compute the world view to screen projection matrix.

 These are inadequate for aligning the mouse movements correctly with the world movement, but they
 provide enough information to create a viewPort alignment. TODO
 */
const screenCoords = [
  document.documentElement.clientWidth,
  document.documentElement.clientHeight,
  0,
  1,
  0,
  document.documentElement.clientHeight,
  0,
  1,
  0,
  0,
  0,
  1,
  document.documentElement.clientWidth,
  0,
  0,
  1
];

const initialState = {
  /*
   All application state except for a few constants
   are defined here. This state must be shared between
   components.
   */
  // Define world coords
  w: () => [...worldCoords],
  // Define screen coords
  s: () => [...screenCoords],
  zoomLevel: 2.0,
  angle: 0,
  screenWidth: document.documentElement.clientHeight,
  screenHeight: document.documentElement.clientWidth,
  centerX: document.documentElement.clientWidth / 2.0,
  centerY: document.documentElement.clientHeight / 2.0,
  currentWorldCoords: {xmin: undefined, xmax: undefined, ymin: undefined, ymax: undefined},
  fetching: false,
  pointBudget: 180000000,
  pointsPerRequest: 1000000,
  pointOffset: 0,
  quads: {
    totalPoints: undefined,
    displayedPoints: 0,
    pointOffsets: [],
  },
  done: {},
};

function App() {
  const [state, dispatch] = React.useReducer(reducer, initialState);

  useEffect(() => {
    // subscribe event
    const overHandler = (event) => { dispatch({type: 'MOUSE_MOVE', event: event}); };
    const scrollHandler = (event) => { dispatch({type: 'SCROLL', event: event}); };
    const clickHandler = (event) => { dispatch({type: 'MOUSE_CLICK', event: event}); };
    const releaseHandler = (event) => { dispatch({type: 'MOUSE_RELEASE', event: event}); };

    window.addEventListener('wheel', scrollHandler);
    window.addEventListener('mousemove', overHandler);
    window.addEventListener('mousedown', clickHandler);
    window.addEventListener('mouseup', releaseHandler);

    return () => {
      // unsubscribe event
      window.removeEventListener('wheel', scrollHandler);
      window.removeEventListener('mousemove', overHandler);
      window.removeEventListener('mousedown', clickHandler);
      window.removeEventListener('mouseup', releaseHandler);
    };
  }, []);

  return (
    <div className='App'>
      <Title/>
      <div className='map-box'>
        <Map/>
          <Particles props={
    initialState}/>
      </div>
      <Controls/>
    </div>
  );
}

export default App;
