/* global window */
import React, {Component} from 'react';
import {render} from 'react-dom';
import {StaticMap} from 'react-map-gl';
import {AmbientLight, PointLight, LightingEffect} from '@deck.gl/core';
import DeckGL from '@deck.gl/react';
import {TripsLayer} from '@deck.gl/geo-layers';
import {IconLayer} from '@deck.gl/layers';

// Set your mapbox token here
const MAPBOX_TOKEN = "pk.eyJ1Ijoic2VhZmFuZyIsImEiOiJja2FyMmZtNWYwYnk4MnNudG9laTd3Mm15In0.PDAK7JcSq3qNtN7l5-U3nQ"

// Source data CSV
const DATA_URL = {
  TRIPS: 'deck_trips.json', // eslint-disable-line
  WAYPOINTS: 'overview1.json' // eslint-disable-line
};

const ICON_MAPPING = {
	marker: {x: 0, y: 0, width: 128, height: 128, mask: true}
};

const ambientLight = new AmbientLight({
  color: [255, 255, 255],
  intensity: 1.0
});

const pointLight = new PointLight({
  color: [255, 255, 255],
  intensity: 2.0,
  position: [-71.06, 42.35, 8000]
});

const lightingEffect = new LightingEffect({ambientLight, pointLight});

const material = {
  ambient: 0.1,
  diffuse: 0.6,
  shininess: 32,
  specularColor: [60, 64, 70]
};

const DEFAULT_THEME = {
  trailColor: [255, 102, 204],
  iconColor: [64, 255, 25],
  material,
  effects: [lightingEffect]
};

const INITIAL_VIEW_STATE = {
  longitude: -71.06,
  latitude: 42.35,
  zoom: 13,
  pitch: 45,
  bearing: 0
};

const landCover = [[[-74.0, 40.7], [-74.02, 40.7], [-74.02, 40.72], [-74.0, 40.72]]];

export default class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      time: 0
    };
  }

  componentDidMount() {
    this._animate();
  }

  componentWillUnmount() {
    if (this._animationFrame) {
      window.cancelAnimationFrame(this._animationFrame);
    }
  }

  _animate() {
    const {
      loopLength = 86400, // unit corresponds to the timestamp in source data
      animationSpeed = 100 // unit time per second
    } = this.props;
    const timestamp = Date.now() / 1000;
    const loopTime = loopLength / animationSpeed;

    this.setState({
      time: ((timestamp % loopTime) / loopTime) * loopLength
    });
    this._animationFrame = window.requestAnimationFrame(this._animate.bind(this));
  }

  _renderLayers() {
    const {
      trips = DATA_URL.TRIPS,
      waypoints = DATA_URL.WAYPOINTS,
      trailLength = 180,
      theme = DEFAULT_THEME
    } = this.props;

    return [
      new TripsLayer({
        id: 'trips',
        data: trips,
        getPath: d => d.path,
        getTimestamps: d => d.timestamps,
        getColor: d => theme.trailColor,
        opacity: 0.6,
        widthMinPixels: 3,
        rounded: true,
        trailLength,
        currentTime: this.state.time,

        shadowEnabled: false
      }),
      new IconLayer({
        id: 'waypoints',
        data: waypoints,
				iconAtlas: 'images/icon-atlas.png',
				iconMapping: ICON_MAPPING,
				getIcon: d => 'marker',
				sizeScale: 10,
        getPosition: d => d.coordinates,
        getSize: 5,
        getColor: d => theme.iconColor
      })
    ];
  }

  render() {
    const {
      viewState,
      mapStyle = 'mapbox://styles/mapbox/dark-v9',
      theme = DEFAULT_THEME
    } = this.props;

    return (
      <DeckGL
        layers={this._renderLayers()}
        effects={theme.effects}
        initialViewState={INITIAL_VIEW_STATE}
        viewState={viewState}
        controller={true}
      >
        <StaticMap
          reuseMaps
          mapStyle={mapStyle}
          preventStyleDiffing={true}
          mapboxApiAccessToken={MAPBOX_TOKEN}
        />
      </DeckGL>
    );
  }
}

export function renderToDOM(container) {
  render(<App />, container);
}
