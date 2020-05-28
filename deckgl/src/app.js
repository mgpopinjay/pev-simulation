import {Deck} from '@deck.gl/core';
import {TripsLayer} from '@deck.gl/geo-layers';
import mapboxgl from 'mapbox-gl';

const TRIPS = 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/trips/trips-v7.json'

const INITIAL_VIEW_STATE = {
	longitude: -71.6,
	latitude: 42.22,
	zoom: 13,
  bearing: 0,
  pitch: 30
};

mapboxgl.accessToken = process.env.MapboxAccessToken;

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v9',
  // Note: deck.gl will be in charge of interaction and event handling
  interactive: false,
  center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
  zoom: INITIAL_VIEW_STATE.zoom,
  bearing: INITIAL_VIEW_STATE.bearing,
  pitch: INITIAL_VIEW_STATE.pitch
});

export const deck = new Deck({
	canvas: 'deck-canvas',
  width: '100%',
  height: '100%',
	initialViewState: INITIAL_VIEW_STATE,
	controller: true,
  onViewStateChange: ({viewState}) => {
    map.jumpTo({
      center: [viewState.longitude, viewState.latitude],
      zoom: viewState.zoom,
      bearing: viewState.bearing,
      pitch: viewState.pitch
    });
  }
	//layers: [new TripsLayer({})]
});
