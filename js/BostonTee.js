class BostonTee {
  constructor(speed, API_KEY, map, opacity) {
    this.API_KEY = API_KEY;
    this.speed = speed;
    this.map = map;
    this.opacity = opacity;

    this.lines = {};
    this.stations = {};
    this.markers = {};

    this.colors = {
      "Blue": '#4286f4',
      "Orange": '#FF8C00',
      "Red": '#FF4500',
    }

    this.stationIcons = {
      "Blue": L.icon({
        iconUrl: './img/blues.png',
        iconSize: [10, 10],
      }),
      "Orange": L.icon({
        iconUrl: './img/oranges.png',
        iconSize: [10, 10],
      }),
      "Red": L.icon({
        iconUrl: './img/reds.png',
        iconSize: [10, 10],
      }),
    }

    this.markerIcons = {
      "Blue": L.icon({
        iconUrl: './img/blueline.png',
        iconSize: [25, 25],
      }),
      "Orange": L.icon({
        iconUrl: './img/orangeline.png',
        iconSize: [25, 25],
      }),
      "Red": L.icon({
        iconUrl: './img/redline.png',
        iconSize: [25, 25],
      }),
    }
  }

  start() {
    this.startLine("Blue");
    this.startLine("Orange");
    this.startLine("Red");
  }

  hide() {
    Object.keys(this.lines).forEach(i => {
      this.lines[i].setStyle({
        opacity: 0,
      })
    })
    Object.keys(this.markers).forEach(i => {
      this.markers[i].forEach(marker => {
        marker.setOpacity(0);
      })
    })
    Object.keys(this.stations).forEach(i => {
      this.stations[i].forEach(station => {
        station.setOpacity(0);
      })
    })
  }

  show() {
    Object.keys(this.lines).forEach(i => {
      this.lines[i].setStyle({
        opacity: this.opacity,
      })
    })
    Object.keys(this.markers).forEach(i => {
      this.markers[i].forEach(marker => {
        marker.setOpacity(this.opacity);
      })
    })
    Object.keys(this.stations).forEach(i => {
      this.stations[i].forEach(station => {
        station.setOpacity(this.opacity);
      })
    })
  }

  startLine(line) {
    this.stations[line] = [];
    getStops(this.API_KEY, line).then(stops => {
      let path = stops.map(station => {
        let mark = new L.marker([station['latlng'][0], station['latlng'][1]], {icon: this.stationIcons[line], opacity: this.opacity}).bindPopup(line + " Line<br/>"+station['name']).addTo(this.map);
        mark.on('mouseover', function (e) {
          this.openPopup();
        });
        mark.on('mouseout', function (e) {
          this.closePopup();
        });
        this.stations[line].push(mark)
        return station.latlng
      })
      this.lines[line] = L.polyline(path, {color: this.colors[line], opacity: this.opacity}).addTo(this.map);
    });


    getTrips(this.API_KEY, line).then((trips) => {
      this.markers[line] = [];
      let startTime = trips[0][0]['start_time']
      console.log(TIME, Date.now(), trips)
      trips.forEach(trip => {
        let tripTimes = [];
        let tripLocations = [];
        trip.forEach(stop => {
          tripTimes.push((stop.end_time - stop.start_time) * this.speed);
          tripLocations.push(stop.start_latlng);
        })
        let marker = L.Marker.movingMarker(tripLocations, tripTimes, {icon: this.markerIcons[line], opacity: this.opacity});
        marker.addTo(this.map);
        this.markers[line].push([marker, (trip[0]['start_time'] - startTime)]);
      })
      this.startTrips(line);
    });
  }

  startTrips(line) {
    this.markers[line].forEach(marker => {
      setTimeout(() => {let mark = marker[0]; mark.start()}, marker[1])
    });
  }
}

function getStops(API_KEY, line) {
  return new Promise(resolve => {
    let ret = [];
    $.get('http://realtime.mbta.com/developer/api/v2/stopsbyroute', {api_key: API_KEY, route: line, format:"json"}, function(data){
      let stops = data['direction'][0]['stop'];
      for(var i=0; i < stops.length; i++) {
        ret.push({
          latlng: [stops[i]['stop_lat'], stops[i]['stop_lon']],
          name: stops[i]['parent_station_name'],
          stop_id: stops[i]['stop_id'],
        });
      }
      resolve(ret);
    });
  });
}

function getTrips(API_KEY, line) {
  return new Promise(resolve => {
    getStops(API_KEY, line).then((stops) => {
      let ret = [];
      $.get('http://realtime.mbta.com/developer/api/v2/schedulebyroute', {api_key: API_KEY, route: line, direction: 0}, function(schedule){
        schedule['direction'].forEach(direction => {
          direction['trip'].forEach(trip => {
            currentTrip = [];
            for(let i=0; i < trip['stop'].length-1; i++) {
              let stop1 = stops.find((element) => {
                return element['stop_id'] == trip['stop'][i]['stop_id'];
              })
              let stop2 = stops.find((element) => {
                return element['stop_id'] == trip['stop'][i+1]['stop_id'];
              })
              currentTrip.push({
                start_latlng: stop1.latlng,
                end_latlng: stop2.latlng,
                start_time: trip['stop'][i]['sch_dep_dt'],
                end_time: trip['stop'][i+1]['sch_dep_dt'],
              })
            }
            ret.push(currentTrip);
          })
        });
        resolve(ret);
      }, 'json');
    });
  });
}
