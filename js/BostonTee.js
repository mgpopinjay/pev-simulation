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
        iconUrl: './images/blues.png',
        iconSize: [10, 10],
      }),
      "Orange": L.icon({
        iconUrl: './images/oranges.png',
        iconSize: [10, 10],
      }),
      "Red": L.icon({
        iconUrl: './images/reds.png',
        iconSize: [10, 10],
      }),
    }

    this.markerIcons = {
      "Blue": L.icon({
        iconUrl: './images/blueline.png',
        iconSize: [25, 25],
      }),
      "Orange": L.icon({
        iconUrl: './images/orangeline.png',
        iconSize: [25, 25],
      }),
      "Red": L.icon({
        iconUrl: './images/redline.png',
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
      trips.forEach(trip => {
        let tripTimes = [];
        let tripLocations = [];
        trip.forEach(stop => {
          tripTimes.push((stop.end_time - stop.start_time) * this.speed);
          tripLocations.push(stop.start_latlng);
        })
        let marker = L.Marker.movingMarker(tripLocations, tripTimes, {icon: this.markerIcons[line], opacity: this.opacity});
        marker.addTo(this.map);
        this.markers[line].push(marker);
      })
      this.markers[line][0].start();
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

// function getBlueStops(API_KEY) {
//   return new Promise(resolve => {
//     let blueStops = [];
//     $.get('http://realtime.mbta.com/developer/api/v2/stopsbyroute', {api_key: API_KEY, route: "Blue", format:"json"}, function(data){
//       let stops = data['direction'][0]['stop'];
//       for(var i=0; i < stops.length; i++) {
//         blueStops.push({
//           latlng: [stops[i]['stop_lat'], stops[i]['stop_lon']],
//           name: stops[i]['parent_station_name'],
//           stop_id: stops[i]['stop_id'],
//         });
//       }
//       resolve(blueStops);
//     });
//   });
// }


// function getBlueTrips(API_KEY) {
//   return new Promise(resolve => {
//     getBlueStops(API_KEY).then((blueStops) => {
//       let blueTrips = [];
//       $.get('http://realtime.mbta.com/developer/api/v2/schedulebyroute', {api_key: API_KEY, route:"Blue", direction: 0}, function(schedule){
//         schedule['direction'].forEach(direction => {
//           direction['trip'].forEach(trip => {
//             currentTrip = [];
//             for(let i=0; i < trip['stop'].length-1; i++) {
//               let stop1 = blueStops.find((element) => {
//                 return element['stop_id'] == trip['stop'][i]['stop_id'];
//               })
//               let stop2 = blueStops.find((element) => {
//                 return element['stop_id'] == trip['stop'][i+1]['stop_id'];
//               })
//               currentTrip.push({
//                 start_latlng: stop1.latlng,
//                 end_latlng: stop2.latlng,
//                 start_time: trip['stop'][i]['sch_dep_dt'],
//                 end_time: trip['stop'][i+1]['sch_dep_dt'],
//               })
//             }
//             blueTrips.push(currentTrip);
//           })
//         });
//         resolve(blueTrips);
//       }, 'json');
//     });
//   });
// }

// function getOrangeLine(API_KEY) {
//   let blueLine = [];
//   $.get('http://realtime.mbta.com/developer/api/v2/stopsbyroute', {api_key: API_KEY, route: "Orange", format:"json"}, function(data){
//     var stops = data['direction'][0]['stop'];
//     for(var i=0; i < stops.length; i++) {
//       blueLine.push({
//         latlng: [stops[i]['stop_lat'], stops[i]['stop_lon']],
//         name: stops[i]['parent_station_name'],
//       });
//     }
//     return blueLine
//   }, 'json');
// }


// function addOrangeLine() {
//     var orangelineStopLine = [];
//     var orangePath = [];
//     $.get('http://realtime.mbta.com/developer/api/v2/stopsbyroute', {api_key:"mTBUGDZNyU6IS_nJpCzNSw", route: "Orange", format:"json"}, function(data2){
//       var route = data2['direction'];
//       // for(var i=0; i<route.length; i++) {
//       for(var k=0; k<1; k++) {
//         var stops = route[k]['stop'];
//         for(var j=0; j < stops.length; j++) {
//           orangePath.push([stops[j]['stop_lat'], stops[j]['stop_lon']]);
//           var orangeIcon = L.icon({iconUrl: './images/oranges.png',iconSize: [10, 10]});
//           var station = new L.marker([stops[j]['stop_lat'], stops[j]['stop_lon']], {icon: orangeIcon}).bindPopup("Orange Line<br/>"+stops[j]['parent_station_name']).addTo(map);
//           orangelineStopLine.push(stops[j]['parent_station_name']);
//           station.on('mouseover', function (e) {
//             this.openPopup();
//           });
//           station.on('mouseout', function (e) {
//             this.closePopup();
//           });
//         }
//       }
//       orangelineAnimation(orangelineStopLine, orangePath);
//     }, 'json');
// }
// function orangelineAnimation(orangelineStopLine, orangePath){
//   var time = [];
//   $.get('http://realtime.mbta.com/developer/api/v2/schedulebyroute', {api_key:"mTBUGDZNyU6IS_nJpCzNSw", route:"Orange", direction: 0}, function(data){
//     for(var i=0; i<data['direction'][0]['trip'][0]['stop'].length; i++) {
//       var subwayTime = data['direction'][0]['trip'][0]['stop'][i]['sch_dep_dt'];
//       var currentTime = Math.round(new Date().getTime()/1000);
//       var operateTime = Math.abs(subwayTime-currentTime) / 1000 * speed;
//       time.push(operateTime);
//     }
//     orangeLinePoly = L.polyline(orangePath, {color: "#FF8C00", opacity: 0.6}).addTo(map);
//     this.orangeIcon = L.icon({
//       iconUrl: './images/orangeline.png',
//       iconSize: [25, 25],
//       opacity: 0.6,
//     });

//     var orangeline = L.Marker.movingMarker(orangeLinePoly.getLatLngs(), time);
//     orangeline.options.icon = orangeIcon;
//     orangeline.addTo(map);
//     orangeline.start();
//   }, 'json')
// }

// function addRedLine() {
//     var redLineStopLine = [];
//     var animatedRedLeftPath = [];
//     var animatedRedRightPath = [];
//     var redPath = [];
//     var redPathLeft = [];
//     var redPathRight = [];

//     $.get('http://realtime.mbta.com/developer/api/v2/stopsbyroute', {api_key:"mTBUGDZNyU6IS_nJpCzNSw", route: "Red", format:"json"}, function(data2){
//       // console.log(data2);
//       var route = data2['direction'];
//       // for(var i=0; i<route.length; i++) {
//       for(var k=0; k<1; k++) {
//         var stops = route[k]['stop'];
//         for(var j=0; j < stops.length; j++) {
//           var redIcon = L.icon({iconUrl: './images/reds.png',iconSize: [10, 10]});
//           if (stops[j]['stop_order'] <=170 && stops[j]['stop_order'] != 130) {
//             animatedRedLeftPath.push([stops[j]['stop_lat'], stops[j]['stop_lon']]);
//           }

//           if (stops[j]['stop_order'] <=220) {
//             if(stops[j]['stop_order']>=130 && stops[j]['stop_order']<=170) {
//               // No
//             } else {
//               animatedRedRightPath.push([stops[j]['stop_lat'], stops[j]['stop_lon']]);
//             }
//           }

//           if(stops[j]['stop_order'] < 130) {
//             redPath.push([stops[j]['stop_lat'], stops[j]['stop_lon']]);
//             var station = new L.marker([stops[j]['stop_lat'], stops[j]['stop_lon']], {icon: redIcon}).bindPopup("Red Line<br/>" + stops[j]['parent_station_name']).addTo(map);
//             station.on('mouseover', function (e) {
//               this.openPopup();
//             });
//             station.on('mouseout', function (e) {
//               this.closePopup();
//             });
//           } else if (stops[j]['stop_order'] >= 140 && stops[j]['stop_order'] <=170) {
//             redPathLeft.push([stops[j]['stop_lat'], stops[j]['stop_lon']]);
//             var station = new L.marker([stops[j]['stop_lat'], stops[j]['stop_lon']], {icon: redIcon}).bindPopup(stops[j]['parent_station_name']).addTo(map);
//             station.on('mouseover', function (e) {
//               this.openPopup();
//             });
//             station.on('mouseout', function (e) {
//               this.closePopup();
//             });

//           } else if (stops[j]['stop_order'] >= 180 && stops[j]['stop_order'] <=220) {
//             redPathRight.push([stops[j]['stop_lat'], stops[j]['stop_lon']]);
//             var station = new L.marker([stops[j]['stop_lat'], stops[j]['stop_lon']], {icon: redIcon}).bindPopup(stops[j]['parent_station_name']).addTo(map);
//             redLineStopLine.push(stops[j]['parent_station_name']);

//             station.on('mouseover', function (e) {
//               this.openPopup();
//             });
//             station.on('mouseout', function (e) {
//               this.closePopup();
//             });
//           }
//         }
//       }

//       redPathLeft.unshift(redPath[redPath.length-1]);
//       redPathRight.unshift(redPath[redPath.length-1]);
//       var redPathPoly = L.polyline(redPath, {color: "#FF4500"});
//       redPathPoly.addTo(map);
//       var redPathLeftPoly = L.polyline(redPathLeft, {color: "#FF4500"}).addTo(map);
//       var redPathRigthPoly = L.polyline(redPathRight, {color: "#FF4500"}).addTo(map);

//       animatedRedLeftPath.unshift(animatedRedLeftPath[0]);
//       animatedRedRightPath.unshift(animatedRedRightPath[0]);
//       var animatedRedLeftPoly = L.polyline(animatedRedLeftPath, {color: "#FF4500"}).addTo(map);
//       var animatedRedRightPoly = L.polyline(animatedRedRightPath, {color: "#FF4500"}).addTo(map);
//       var redIcon = L.icon({
//         iconUrl: './images/redline.png',
//         iconSize: [25, 25]
//       });
//       var time = [];
//       for(var i=0; i<animatedRedRightPoly.getLatLngs().length; i++){
//         time.push(2000);
//       }
//       var redline = L.Marker.movingMarker(animatedRedRightPoly.getLatLngs(), time);
//       redline.options.icon = redIcon;
//       redline.addTo(map);
//       redline.start();
//       redlineAnimation(redLineStopLine, redPathLeft, redPathRight);
//     }, 'json');
// }


// function redlineAnimation(redlineStopLine, redPath, redPathRight){
//   var timeRight = [];
//   var timeLeft = [];
//   $.get('http://realtime.mbta.com/developer/api/v2/schedulebyroute', {api_key:"mTBUGDZNyU6IS_nJpCzNSw", route:"Red", direction: 0}, function(data){
//     for(var i=0; i<data['direction'][0]['trip'][0]['stop'].length; i++) {
//       var subwayTime = data['direction'][0]['trip'][0]['stop'][i]['sch_dep_dt'];
//       var currentTime = Math.round(new Date().getTime()/1000);
//       var operateTime = Math.abs(subwayTime-currentTime) / 1000 * SUBWAYSPEED;
//       timeRight.push(operateTime);
//     }

//     for(var i=0; i<data['direction'][0]['trip'][3]['stop'].length; i++) {
//       var subwayTime = data['direction'][0]['trip'][3]['stop'][i]['sch_dep_dt'];
//       var currentTime = Math.round(new Date().getTime()/1000);
//       var operateTime = Math.abs(subwayTime-currentTime) / 1000 * SUBWAYSPEED;
//       timeLeft.push(operateTime);
//     }

//     var redLinePoly = L.polyline(redPath, {color: "#FF8C00", opacity: T_opacity}).addTo(map);
//     var redIcon = L.icon({
//         iconUrl: './images/orangeline.png',
//         iconSize: [25, 25]
//       });
//     var redline = L.Marker.movingMarker(redLinePoly.getLatLngs(), timeLeft);
//     redline.options.icon = redIcon;
//     redline.addTo(map);
//     redline.start();

//     var redLinePolyRight = L.polyline(redPathRight, {color: "#FF8C00", opacity: T_opacity}).addTo(map);
//     var redlineRigth = L.Marker.movingMarker(redLinePolyRight.getLatLngs(), timeRight);
//     redlineRigth.options.icon = redIcon;
//     redlineRigth.addTo(map);
//     redlineRigth.start();
//   }, 'json')
// }
