"use strict";

var trips = [];
var Maps = google.maps;
var Directions = new Maps.DirectionsService();
var lines = [];
var intervals = [];
var tripID;
var map;
var mapOptions;
var t;
var markers = [];
var bTime = 0;
var bDist = 0;
var dTime = 0;
var dDist = 0;
var taxiTime = 0;

// Json data
var sim_data;
var sim_tstep = 4;
var sim_framestep = 25;

var sim_hm_passStart;
var sim_hm_passEnd;
var sim_hm_parcStart;
var sim_hm_parcEnd;
var sim_passDropoffs = new Maps.MVCArray([]);
var sim_passPickups = new Maps.MVCArray([]);
var sim_parcDropoffs = new Maps.MVCArray([]);
var sim_parcPickups = new Maps.MVCArray([]);

//var sim_graphics = [];

var allLines = {};
var mode = {};

var emissions = [0, 0, 0];
var tot_distances = [0, 0, 0];
var emissions_coeffs = [2, 10, 5];
var person_wait_times = [
  { key: 0, value: 0 },
  { key: 5, value: 0 },
  { key: 10, value: 0 },
  { key: 15, value: 0 },
  { key: 20, value: 0 },
  { key: 25, value: 0 },
  { key: 30, value: 0 },
  { key: 35, value: 0 }];
  var package_wait_times = [
    { key: 0, value: 0 },
    { key: 5, value: 0 },
    { key: 10, value: 0 },
    { key: 15, value: 0 },
    { key: 20, value: 0 },
    { key: 25, value: 0 },
    { key: 30, value: 0 },
    { key: 35, value: 0 }];


    var c_taxi_time=0;
    var t_taxi_time=0;


    // window.localStorage.setItem(id, json string)


    $(function() {
      $( "#sliderFleetSize" ).slider({
        value: 20,
        min: 0,
        max: 250,
        step: 10,
        slide: function( event, ui ) {
          $( "#fleetSize" ).val( ui.value );
        }
      });
      $( "#fleetSize" ).val(  $( "#sliderFleetSize" ).slider( "value" ) );
    });


    $(function() {
      $( "#sliderMaxTripDist" ).slider({
        value: 3,
        min: 1,
        max: 5,
        step: .5,
        slide: function( event, ui ) {
          $( "#maxTripDist" ).val( ui.value + " mi" );
        }
      });
      $( "#maxTripDist" ).val( $( "#sliderMaxTripDist" ).slider( "value" ) + " mi"  );
    });


    $(function() {
      $( "#sliderParcelAmount" ).slider({
        value: 10,
        min: 0,
        max: 250,
        step: 10,
        slide: function( event, ui ) {
          $( "#parcelAmount" ).val( ui.value + " /hr");
        }
      });
      $( "#parcelAmount" ).val(  $( "#sliderParcelAmount" ).slider( "value" ) + " /hr"  );
    });

    $(function() {
      $( "#sliderSimSpeed" ).slider({
        value: 10,
        min: 5,
        max: 20,
        step: 1,
        slide: function( event, ui ) {
          $( "#simSpeed" ).val( ui.value + "x" );
        }
      });
      $( "#simSpeed" ).val(  $( "#sliderSimSpeed" ).slider( "value" ) + "x"  );
    });

    function setMapNewbury() {
      map.center = new Maps.LatLng(42.3519319, -71.0827417);
      map.setZoom(15);
    }

    function setMapBoston() {
      map.center = new Maps.LatLng(42.359456, -71.076336);
      map.setZoom(14)
    }

    function day() {
      var time = 0;
      var timeLines = makeTimeLines();
      window.setInterval(function() {
        if (timeLines[time]) {
          timeLines[time].forEach(tripChanged);
        }
        time++;
      }, 1000);
      alert('b2');
    }

    function makeTimeLines() {
      var timeLines = {};
      function timeParse(trip) {
        var t = new Date(trip.start.time).getTime();
        t %= 86400000;
        t /= 60000;
        var key = Math.floor(t);
        key -= 240;
        if (timeLines[key]) {
          timeLines[key].push(trip);
        }
        else {
          timeLines[key] = [];
        }
      }
      console.log(timeParse);
      trips.forEach(timeParse);
      // console.log(timeLines);
      return timeLines;
    }


    function start() {
      for (var m = 0; m < markers.length; m++) {
        markers[m].setMap(null);
      }
      document.getElementById("bothBtn").disabled = true;
      document.getElementById("bikeBtn").disabled = true;
      document.getElementById("driveBtn").disabled = true;

      t = 0;
      tripChanged(trips[t]);
      $("ol#trip-list li:nth-child(" + (t + 1) + ")").css("opacity", "1");
    }

    function bike() {
      mode = {};
      mode[Maps.TravelMode.BICYCLING] = true;
      start();
    }

    function car() {
      mode = {};
      mode[Maps.TravelMode.DRIVING] = true;
      start();
    }

    function both() {
      mode = {};
      mode[Maps.TravelMode.BICYCLING] = true;
      mode[Maps.TravelMode.DRIVING] = true;
      start();
    }

    function fleet_sim() {
      var fleet_size = $('#fleetSize').val();
      var maxDist = $('#maxTripDist').val();
      var parcelFreq = $('#parcelAmount').val();
      var sim_params = {
        size: fleet_size,
        maxDist: maxDist,
        parcels: parcelFreq,
      };
      $.post( '/fleetsim', JSON.stringify(sim_params), function( data ) {
        console.log(data);
        sim_data = data;
        animateCars();
      }, 'json');
    }

    // TEST Simulation Button Click시 호출! - Program의 Start Point
    function test_fleet_sim() {
      var fleet_size = $('#fleetSize').val();
      var maxDist = $('#maxTripDist').val();
      var parcelFreq = $('#parcelAmount').val();
      var sim_params = {
        size: fleet_size,
        maxDist: maxDist,
        parcels: parcelFreq,
      };
      /* sim_params는 Graph Paraemter의 기능!
      EX> size: 20, maxDist: 3mile, parcels: 10 h/r
      */

      /*
      jQuery의 함수
      Load data from the server using a HTTP POST request.
      단순히 server폴더의 sim2.json파일의 내용을 가져와 sim_data변수에 저장!

      */
      $.post( '/server/sim2.json', JSON.stringify(sim_params), function( data ) {
        console.log(data);
        sim_data = data;
        animateCars();
      }, 'json');
      //  sim_data는 단순히 sim2.json파일의 내용을 저장한 json Object이다.
    }

    function taxi(trip) {
      var start   = new Date(trip.start.time);
      var end     = new Date(trip.end.time);
      var time = (end - start)/1000;
      taxiTime += time;
      $("p#c-taxi-time").html(expandTime(time));
      $("p#t-taxi-time").html(expandTime(taxiTime));
      c_taxi_time=expandTime(time);
      t_taxi_time=expandTime(taxiTime);

      if (typeof(Storage) !== "undefined") {
        // Store
        localStorage.setItem("c_taxi_time",c_taxi_time);
        // Retrieve
        // document.getElementById("result").innerHTML = localStorage.getItem("lastname");
        // console.log(localStorage.getItem("c_taxi_time"));
      } else {
        console.log("Sorry, your browser does not support Web Storage...");
      }


    }

    function expandTime(time) {
      var hours   = Math.floor(time/3600);
      time %= 3600;
      var minutes = Math.floor(time/60);
      var seconds = time%60;
      return hours + "hrs " + minutes + "min ";

      // + seconds + "sec"

    }

    function clear() {
      bTime = 0;
      bDist = 0;
      dTime = 0;
      dDist = 0;
      $("p#bike-time").html(expandTime(bTime));
      $("p#bike-dist").html(bDist + " meters");
      $("p#drive-time").html(expandTime(dTime));
      $("p#drive-dist").html(dDist + " meters");
    }
    //Why? sort by time

    function sortByTime(trips) {
      trips.sort(function(a,b) {
        var c = new Date(a.start.time);
        var d = new Date(b.start.time);
        return c - d;
      })
    }

    function accumulator(mark) {
      if (mark.travelMode === Maps.TravelMode.BICYCLING) {
        bTime += mark.travelTime.value;
        bDist += mark.travelDistance.value;
      }
      else if (mark.travelMode === Maps.TravelMode.DRIVING) {
        dTime += mark.travelTime.value;
        dDist += mark.travelDistance.value;
      }
      $("p#bike-time").html(expandTime(bTime));
      $("p#bike-dist").html(bDist + " meters");
      $("p#drive-time").html(expandTime(dTime));
      $("p#drive-dist").html(dDist + " meters");
    }


    /*
    sim_hm_passStart, sim_hm_passEnd (황색 - 하늘색) - hitmap 객체!
    sim_hm_parcStart, sim_hm_parcEnd (하늘색 - 황색)- hitmap 객체!
    열지도 계층을 추가하려면 먼저 새 HeatmapLayer 객체를 생성하고,
    배열이나 MVCArray[] 객체의 형태로 몇 가지 지리적 데이터를 제공해야 합니다.
    데이터는 LatLng 객체 또는 WeightedLocation 객체가 될 수 있습니다.
    HeatmapLayer 객체를 인스턴스화한 후에 setMap() 메서드를 호출하여 지도에 추가합니다.
    */
    function initHeatmaps() {
      // sim_passDropoffs - MVCArray[]
      sim_hm_passEnd = new Maps.visualization.HeatmapLayer({
        data: sim_passDropoffs,
        map: map,
        radius: 40,
        opacity: .2,
        gradient: [
          'rgba(60, 170, 255, 0)',
          'rgba(60, 170, 255, 1)',
        ]
      });
      sim_hm_passStart = new Maps.visualization.HeatmapLayer({
        data: sim_passPickups,
        map: map,
        radius: 40,
        opacity: .2,
        gradient: [
          'rgba(255, 200, 0, 0)',
          'rgba(255, 200, 64, 1)',
        ]
      });

      sim_hm_parcStart = new Maps.visualization.HeatmapLayer({
        data: sim_parcPickups,
        map: map,
        radius: 40,
        opacity: .2,
        gradient: [
          'rgba(255, 200, 0, 0)',
          'rgba(255, 200, 64, 1)',
        ]
      });

      sim_hm_parcEnd = new Maps.visualization.HeatmapLayer({
        data: sim_parcDropoffs,
        map: map,
        radius: 40,
        opacity: .2,
        gradient: [
          'rgba(60, 170, 255, 0)',
          'rgba(60, 170, 255, 1)',
        ],
      });
    }


    // ACTIVATION/DEACTIVATION OF HEATMAP TYPES
    function togglePassHeatmap() {
      sim_hm_passStart.setMap(sim_hm_passStart.getMap() ? null : map);
      sim_hm_passEnd.setMap(sim_hm_passEnd.getMap() ? null : map);
    };

    function toggleParcHeatmap() {
      sim_hm_parcStart.setMap(sim_hm_parcStart.getMap() ? null : map);
      sim_hm_parcEnd.setMap(sim_hm_parcEnd.getMap() ? null : map)
    };


    function drawUtilization() {
      //layers = [util_human, util_parc]
      // 사람과 짐의 그래프 시작 점 및 인덱스
      var layers = zipUtilization();
      drawUtil(layers);
    }



    /*
    화면 상단의 그래프를 그려주는 함수!!
    - 24는 그래프의 0~23 범위를 의미
    - 정작 json에서 받아온 데이터는 13개 뿐임!
    - Data Sample
    "util":[
    [
    [0][0] -> 0.038796296296296294,
    [0][1] -> 0.018111111111111113,
    [0][2] -> 0.15507407407407406
  ]
  .............
}
- util_human: 사람 그래프의 값!
x: Graph의 index
y: Graph의 value
y0: Graph의 Start point
- util_parc: 사물의 값!
x: Graph의 index
y: Graph의 value
y0: Graph의 Start point
*/
function zipUtilization() {
  // zip layers into len-24 arrays of format
  // [(index, y-value, y-min), ... ]
  var util_human = [];
  var util_parc = [];
  for (var i = 0; i < 24; i++) {
    if (i < sim_data.util.length) {
      util_human.push({
        x: i,
        y: sim_data.util[i][0],
        y0: 0,
      });

      util_parc.push({
        x: i,
        y: sim_data.util[i][0] + sim_data.util[i][1],
        y0: sim_data.util[i][0],
      });
    } else {
      util_human.push({
        x: i,
        y: 0,
        y0: 0,
      });
      util_parc.push({
        x: i,
        y: 0,
        y0: 0,
      });
    }
  }
  return [util_human, util_parc];
}

function calculateTripWaitTime(data) {
  // TODO: don't count actual trips as wait time
  // rounding to nearest multiple of 5
  var wait_time = Math.round(data.route.duration/60/5);
  if (wait_time > 7) wait_time = 7;
  if (data.is_human) {
    person_wait_times[wait_time].value += 1;
  } else {
    package_wait_times[wait_time].value += 1;
  }
  drawPersonWaitTime(person_wait_times);
  drawPackageWaitTime(package_wait_times);
}


//  2번째 함수 호출 Stack!
function animateCars() {
  // like animateLines but for cars with a schedule of many things to do
  // first clear the intervals
  // intervals = [] 단순한 배열!!!! (버튼을 재 클릭시 초기화 목적!)
  for (var i = 0; i < intervals.length; i++) {
    // clearInterval - setInterval로 반복하고 있는 작업을 정지!
    window.clearInterval(intervals[n]);
  }
  // 화면 상단의 사람과 짐에 해당하는 그래프를 그려주는 함수
  drawUtilization();
  /*
  sim_data: 기존의 sim2.json파일
  tstep: 거기에 tstep key를 추가
  */
  sim_data['tstep'] = 0;

  // Set up global time
  /*
  setInterval- 일정 시간 마다 function 시작! (function, delay)
  delay - 1000ms (1초)
  sim_framestep = 25
  0.025초마다 tstep을 4씩 증가!
  1초에 40번 호출 -> 160step 증가
  1분에 9600step
  */
  interval = window.setInterval(function() {
    if (!interval) {
      return;
    }
    sim_data.tstep += sim_tstep;
  }, sim_framestep);
  intervals.push(interval);

  // initHeatmaps();
  drawUtilization();
  var interval;
  // sim_factor의 기능????
  var sim_factor = 10;
  // sim2.json에 curTask, shown, curHour가 추가된 새로운 json형태!
  sim_data['curTask'] = 0;
  sim_data['shown'] = [];
  sim_data['curHour'] = 0;

  interval = window.setInterval(function() {
    if (!interval) {
      return;
    }
    // TODO fuck it we'll just redraw the whole thing for now
    // tstep을 4씩 증가 시켜서 1시간 소요시 시간을 1 증가시켜준다!
    if (sim_data.curHour < sim_data.tstep / 3600) {
      // New hour
      sim_data.curHour++;
      if (sim_data.curHour < sim_data.emissions.length) {
        // emissions[0] = sim_data.emissions[sim_data.curHour];
        // drawEmissionChart(emissions);
      }
    }

    // console.log(sim_data.curHour);
    // curTask 초기에는 0 -> 해야할일(zim_data.trips.length: 117)
    // json의  trip data를 의미함!!
    if (sim_data.curTask < sim_data.trips.length) {
      while (sim_data.tstep >= sim_data.trips[sim_data.curTask].time_ordered) {
        // draw the caller
        // drawUtilization();
        // 신경 쓸필요 X!! Start!
        calculateTripEmission(sim_data.trips[sim_data.curTask], true);
        drawEmissionChart(emissions);
        calculateTripWaitTime(sim_data.trips[sim_data.curTask]);
        // 신경 쓸필요 X!! END!
        var origin = {lat: sim_data.trips[sim_data.curTask].start_loc[0], lng: sim_data.trips[sim_data.curTask].start_loc[1]};
        var marker;
        // 사람일 경우 사람 무늬 출력
        if (sim_data.trips[sim_data.curTask].is_human) {
          var childIcon = L.icon({iconUrl: 'child.png',iconSize: [20, 20]});
          marker = L.marker([sim_data.trips[sim_data.curTask].start_loc[0], sim_data.trips[sim_data.curTask].start_loc[1]], {icon: childIcon}).addTo(map);
        }
        else {
          var parcelIcon = L.icon({iconUrl: 'parcel.png', iconSize: [20, 20]});
          marker = L.marker([sim_data.trips[sim_data.curTask].start_loc[0], sim_data.trips[sim_data.curTask].start_loc[1]], {icon: parcelIcon}).addTo(map);
        }

        marker.info = {};
        //  Json marker라는 이름의 키를 추가후 생성된 마커들을 저장!!!
        sim_data.trips[sim_data.curTask]['marker'] = marker;

        // sim_data json에 배열Type인 shown을 추가!
        sim_data.shown.push(sim_data.curTask);
        //  처리완료시 curTask수를 증가!!!
        sim_data.curTask++;
        //  여정보다 같거나 길경우 함수를 빠져나감!
        if (sim_data.curTask >= sim_data.trips.length) {
          break;
        }
      }
    }

    //    분석 필요!!
    if (sim_data.shown.length > 0) {
      // disappear old tasks that have completed
      // TODO use a heap implementation for speed ?
      for (var i = 0; i < sim_data.shown.length; i++) {
        var tripIdx = sim_data.shown[i];
        if (sim_data.trips[tripIdx].pickup <= sim_data.tstep) {
          // remove element
          // setMap은 marker remove -> leaflet에서는 removeLayer를 사용한다!
          // Ex> sim_data.trips[tripIdx].marker.setMap(null);
          // Data참조> console.log(sim_data.trips[tripIdx].marker['_latlng'] +"1");
          map.removeLayer(sim_data.trips[tripIdx].marker);
        }
        if (sim_data.trips[tripIdx].is_human) {
          // console.log(sim_data.trips[tripIdx].marker['_latlng']);
          sim_passPickups.push(sim_data.trips[tripIdx].marker.position);
        } else {
          sim_parcPickups.push(sim_data.trips[tripIdx].marker.position);
        }
        sim_data.trips[tripIdx].marker = null;
        // remove element at [i]
        sim_data.shown.splice(i, 1);
        i--; // I hate doing this
      }
    }
  }, sim_framestep * sim_factor);
  intervals.push(interval);

  // TODO how do I extract and render statistics at the frame level?
  // Should I just check and update every time a car finishes a trip or
  // something (and have a callback)
  sim_data.fleet.vehicles.forEach(drawCarStuff);
  // console.log(sim_data.fleet.vehicles[0]['history']);
  // drawCarStuff(sim_data.fleet.vehicles[0]);
}

function drawCarStuff(car) {
  car.current = 0;
  var latLngLoc = {lat: car.spawn[0], lng: car.spawn[1]};
  var carMakerIcon = L.icon({iconUrl: 'circle.png',iconSize: [20, 20]});
  var carMarker = L.marker([ car.spawn[0],  car.spawn[1]], {icon: carMakerIcon}).addTo(map);
  car['curTaskRender'] = carMarker;
  var interval; // I guess I declare this to have a static reference?

  // var time = car.history[car.current]['start'];
  interval = window.setInterval(function() {
    if (!interval) {
      return;
    }

    var newTask = false;
    // history를 하니씩 출력하면서 curren를 1씩 증가!
    if (car.current >= car.history.length) {
      // alert("car.current >= car.history.length");
      return;
    }

    // update the car to the tstep
    //  car.current는 0으로 고정!!!이 후 1씩 증가!
    var ctask = car.history[car.current]
    // console.log(car.history[car.current]['end']);

    while (sim_data.tstep >= ctask.end) {
      // console.log("Index: " + car.current);
      // console.log("sim_data.tstep: " +sim_data.tstep);
      // console.log("ctask.end: " +ctask.end);
      if (ctask.kind == "PASSENGER") {
        // TODO Find good gaussian icon
        var dest = {lat: ctask.dest[0], lng: ctask.dest[1]};
        sim_passDropoffs.push(dest);
        console.log("[PASSENGER Case]");
      }
      else if (ctask.kind == "PARCEL") {
        var dest = {lat: ctask.dest[0], lng: ctask.dest[1]};
        sim_parcDropoffs.push(dest);
        console.log("[PARCEL Case]");
      }
    }
    car.current++;
    newTask = true;
    if (car.current >= car.history.length) {
      // What do we do when we're at the end of the sim?
      // TODO
      var loc = {lat: ctask.dest[0], lng: ctask.dest[1]};
      var carMakerIcon = L.icon({iconUrl: 'circle.png',iconSize: [20, 20]});
      var carMarker = L.marker([loc['lat'], loc['lng']], {icon: carMakerIcon}).addTo(map);
      map.removeLayer(car.curTaskRender);
      car.curTaskRender = carMarker;
      map.addLayer(car.curTaskRender);
      return;
    }
    ctask = car.history[car.current];
  }
}

// console.log(ctask);
//  various tasks - based on car.history[car.current]
// var legs = ctask.route.rte.legs;
switch(car.history[car.current].kind) {
  case 'IDLE':
  if (newTask) {
    var loc = {lat: ctask.dest[0], lng: ctask.dest[1]};
    var carMakerIcon = L.icon({iconUrl: 'circle.png',iconSize: [20, 20]});
    var carMarker = L.marker([ loc['lat'], loc['lng']], {icon: carMakerIcon}).addTo(map);
    map.removeLayer(car.curTaskRender);
    car.curTaskRender = carMarker;
    map.addLayer(car.curTaskRender);
  }
  break;
  case 'NAV':
  if (newTask) {
    ctask['color'] = 'white';
    // Draw a line from the car's polyline
    var polyline = polylineFromTask(ctask);
    map.removeLayer(car.curTaskRender);
    car.curTaskRender = polyline;
  }
  else {
    // var icons = car.curTaskRender.get('icons');
    // console.log(icons);
    //     icons[0].offset = ( ((sim_data.tstep - ctask.start) / (ctask.route.duration)) * 100 ) + '%'; // google maps api stuff here
    //     car.curTaskRender.set('icons', icons);
  }
  map.addLayer(car.curTaskRender);
  break;
  case 'PASSENGER':
  if (newTask) {
    //  Yello Color;
    ctask['color'] = '#F0F000';
    // Draw a line from the car's polyline
    var polyline = polylineFromTask(ctask);
    map.removeLayer(car.curTaskRender);
    car.curTaskRender = polyline;
  } else {
    //     var icons = car.curTaskRender.get('icons');
    //     icons[0].offset = ( ((sim_data.tstep - ctask.start) / (ctask.route.duration)) * 100 ) + '%'; // google maps api stuff here
    //     car.curTaskRender.set('icons', icons);
  }
  map.addLayer(car.curTaskRender);
  break;
  case 'PARCEL':
  if (newTask) {
    // Orange Color
    ctask['color'] = '#FF8000'
    // Draw a line from the car's polyline
    var polyline = polylineFromTask(ctask);
    map.removeLayer(car.curTaskRender);
    car.curTaskRender = polyline;
  } else {
    //     var icons = car.curTaskRender.get('icons');
    //     icons[0].offset = ( ((sim_data.tstep - ctask.start) / (ctask.route.duration)) * 100 ) + '%'; // google maps api stuff here
    //     car.curTaskRender.set('icons', icons);
  }
  map.addLayer(car.curTaskRender);
  break;
  default:
  alert('error');
}


//    Car is going somewhere
//      draw current line and car position on it
//      color := package (dark green)/ passenger (light green)/navigation (de-sat green)
//    Car is loitering
//      draw car at position
//      color := loiter color (de-sat green)?
// sim_framestep+=car.history[car.current]['end'];
}, sim_framestep * 2);
intervals.push(interval);
}

function polylineFromTask(ctask) {
  var polyline;
  var polylinePath = [];
  var animateTime = [];
  // Credits to http://www.geocodezip.com/V3_Polyline_from_directions.html
  var path = ctask.route.rte.overview_polyline.points;
  var legs = ctask.route.rte.legs;
  for (var i = 0; i < legs.length; i++) {
    var steps = legs[i].steps;
    for (var j = 0; j < steps.length; j++) {
      var nextSegment = google.maps.geometry.encoding.decodePath(steps[j].polyline.points);
      for (var k = 0; k < nextSegment.length; k++) {
        polylinePath.push([nextSegment[k].lat(), nextSegment[k].lng()]);
        animateTime.push(parseInt(legs[i].duration.value));
        // for(var z=0; z<intervals[i].length; z++) {
        //   intervals[i][z] = intervals[i][z]/10000;
        // }
        // animateTime.push(1000);
      }
    }
  }
  polyline = L.polyline(polylinePath, {color: ctask.color}).addTo(map)
  polyline.opacity = 0.5;
  polyline.weight = 7;

  // Total Time Cost Calculation
  // var totalTimeCoat = 0;
  // for(var i=0; i<animateTime.length; i++) {
  //   totalTimeCoat += animateTime[i];
  // }
  // console.log("Total Time Coast is " + totalTimeCoat);
  var myMovingMarker = L.Marker.movingMarker(polylinePath, 1142).addTo(map);
  // console.log(animateTime);
  myMovingMarker.on('start', function(){
    // map.removeLayer(this);
  });

  myMovingMarker.on('end', function(){
    map.removeLayer(this);
    // map.removeLayer(polyline);
  });
  myMovingMarker.start();


  return polyline;
}

function animateLines() {
  // console.log("animateLines()");
  for (var n = 0; n < intervals.length; n++) {
    window.clearInterval(intervals[n]);
  }
  var finished = 0;

  lines.forEach(function(line) {
    // Prepare the circular symbol for the bike or taxi
    var lineSymbol = {
      path: Maps.SymbolPath.CIRCLE,
      scale: 8,
      strokeColor: line.strokeColor,
    };

    // add the circular symbol to the line
    line.icons.push({
      icon: lineSymbol,
      offset: "0%", // at the starting position
    });


    var count = 0; // Time step
    var interval; // basically a frame of rendering

    interval = window.setInterval(function() {
      if (!interval) {
        return;
      }

      // increment the time step (seconds of real time)
      count += 5;
      console.log("Time: " + line.travelTime);
      if (count > line.travelTime.value) { // check if the trip finished
        // and clear the icon; the vehicle can disappear
        window.clearInterval(interval);
        finished += 1;
        interval = undefined;

        if (finished === lines.length) { // if all the lines at this step are done
          // proceed to rendering the next trip
          tripChanged(trips[++t]);
          $("ol#trip-list li:nth-child(" + (t + 1) + ")").css("opacity", "1"); // some jquery I don't understand
          lines.forEach(function(polyline) {
            accumulator(polyline); // I think this is just unused statistics stuff
          });
          lines.forEach(function(polyline) {
            polyline.setMap(null); // stop drawing it I think?
          });
          lines = []; // and... ? probably clear it since it's a global variable (yay?)
          return;
        }
      }
      // whether the trip is finished or not...
      // update lines.icons[0] (which I think is the only icon [?]) to have advanced a percentage of the trip
      var icons = line.get('icons');
      icons[0].offset = ( (count / line.travelTime.value) * 100 ) + '%'; // google maps api stuff here
      line.set('icons', icons);
    }, 20); // ms per interval
    intervals.push(interval); // ...and push intervals? maybe this is necessary to render?
  });
}

function drawPaths(paths, origin, id) {

  var marker = new Maps.Marker({
    position: origin,
    map: map,
    icon: {
      path: fontawesome.markers.CHILD,
      scale: 0.5,
      strokeWeight: 0.1,
      strokeColor: '#FFFF00',
      strokeOpacity: 1,
      fillColor: '#FFFF00',
      fillOpacity: 1
    },
    clickable: false,
  });
  marker.info = {};
  allLines[id] = [];
  //Maps.LatLngBounds(): Constructs a rectangle from the points at its south-west and north-east corners.
  var bounds = new Maps.LatLngBounds();
  for (var p = 0; p < paths.length; p++) {
    var color;
    if (paths[p].request.travelMode === Maps.TravelMode.BICYCLING) {
      color = "#00FF00";
    } else {
      color = "#FF0000";
    }

    var polyline = new Maps.Polyline({
      path: [],
      icons: [],
      strokeColor: color,
      strokeOpacity: 0.5,
      strokeWeight: 7,
    });

    // Credits to http://www.geocodezip.com/V3_Polyline_from_directions.html
    var path = paths[p].routes[0].overview_path;
    var legs = paths[p].routes[0].legs;
    // console.log(paths[p].routes[0]);
    for (var i = 0; i < legs.length; i++) {
      var steps = legs[i].steps;
      for (var j = 0; j < steps.length; j++) {
        var nextSegment = steps[j].path;
        for (var k = 0; k < nextSegment.length; k++) {
          polyline.getPath().push(nextSegment[k]);
          bounds.extend(nextSegment[k]);
        }
      }
    }

    polyline.travelMode     = paths[p].request.travelMode;
    polyline.travelDistance = paths[p].routes[0].legs[0].distance;
    polyline.travelTime     = paths[p].routes[0].legs[0].duration;
    polyline.setMap(map);
    lines.push(polyline);
    allLines[id].push(polyline);

    var popup = new Maps.InfoWindow({
      content: "Distance: " + polyline.travelDistance.value+ "\n"
      + "Duration: "+ polyline.travelTime.value
    });
    Maps.event.addListener(marker, 'click', function(){
      popup.open(map, marker);
    });
    marker.info[polyline.travelMode] = {
      distance: polyline.travelDistance,
      time:     polyline.travelTime,
    };
    marker.info.id = id;
  }
  map.fitBounds(bounds);
  map.setZoom(map.getZoom() - 1);
  if (marker.info[Maps.TravelMode.BICYCLING]) {
    $("p#c-bike-time").html(expandTime(marker.info[Maps.TravelMode.BICYCLING].time.value));
    $("p#c-bike-dist").html(marker.info[Maps.TravelMode.BICYCLING].distance.value + " meters");
  }
  if (marker.info[Maps.TravelMode.DRIVING]) {
    $("p#c-drive-time").html(expandTime(marker.info[Maps.TravelMode.DRIVING].time.value));
    $("p#c-drive-dist").html(marker.info[Maps.TravelMode.DRIVING].distance.value + " meters");
  }
  var stored = {
    "BICYCLING": marker.info[Maps.TravelMode.BICYCLING],
    "DRIVING": marker.info[Maps.TravelMode.DRIVING]
  }
  // console.log(stored);
  // window.localStorage(marker.info.id, JSON.stringify(stored));
  Maps.event.addListener(marker, 'click', function() {
    marker_data(marker.info);
  });
}

function marker_data(info) {
  lines.forEach(function(line) {
    line.setMap(null);
  });

  lines = [];

  if (tripID === info.id) {
    // accumulator({});
    tripID = undefined;
    return;
  }
  tripID = info.id;

  if (marker.info[Maps.TravelMode.BICYCLING]) {
    var bTimeSpecific = info[Maps.TravelMode.BICYCLING].time.value;
    var bDistSpecific = info[Maps.TravelMode.BICYCLING].distance.value;
    $("p#c-bike-time").html(expandTime(bTimeSpecific));
    $("p#c-bike-dist").html(bDistSpecific + " meters");
  }
  if (marker.info[Maps.TravelMode.DRIVING]) {
    var dTimeSpecific = info[Maps.TravelMode.DRIVING].time.value;
    var dDistSpecific = info[Maps.TravelMode.DRIVING].distance.value;
    $("p#c-drive-time").html(expandTime(dTimeSpecific));
    $("p#c-drive-dist").html(dDistSpecific + " meters");
  }

  allLines[info.id].forEach(function(line) {
    lines.push(line);
    line.setMap(map);
  });
}

function getRouteDistance(route) {
  var sum = 0;
  for (var i = 0; i < route.legs.length; i++) {
    sum += route.legs[i].distance.value;
  }
  return sum;
}

function calculateEmissions(paths) {
  // console.log(paths);
  for (var i = 0; i < paths.length; i++) {
    if (paths[i].request.travelMode === Maps.TravelMode.BICYCLING) {
      tot_distances[0] = getRouteDistance(paths[i].routes[0]);
    } else if (paths[i].request.travelMode === Maps.TravelMode.DRIVING) {
      tot_distances[1] = getRouteDistance(paths[i].routes[0]);
      tot_distances[2] = getRouteDistance(paths[i].routes[0]);
    }
  }

  for (var i = 0; i < emissions.length; i++) {
    emissions[i] = tot_distances[i] * emissions_coeffs[i] / 10000
  }
  //normalize_emissions()
}

function normalize_emissions() {
  var denom = d3.max(emissions) / 10;
  if (denom > 0) {
    for (var i = 0; i < emissions.length; i++) {
      emissions[i] = emissions[i] / denom;
    }
  }
}

function calculateTripEmission(trip, isCar) {
  if (isCar) {
    tot_distances[1] = trip.route.distance;
    tot_distances[2] = trip.route.distance;
    // } else {
    tot_distances[0] = trip.route.distance;
  }

  for (var i = 0; i < emissions.length; i++) {
    emissions[i] += tot_distances[i] * emissions_coeffs[i] / 10000;
  }
  //normalize_emissions()
}

function tripChanged(trip) {
  if (!trip) {
    return
  }
  taxi(trip);

  var res = [];
  var origin      = new Maps.LatLng(trip.start.lat, trip.start.long);
  var destination = new Maps.LatLng(trip.end.lat, trip.end.long);
  var dirfunc = function(response, status) {
    if (status == Maps.DirectionsStatus.OK) {
      res.push(response);
      //What is Object>.keys(mode)
      if (res.length === Object.keys(mode).length) {
        // TODO total trip distances and calculate emissions
        calculateEmissions(res)
        drawPaths(res, origin, trip.id);
        alert('breakpt');
        animateLines();
        drawEmissionChart(emissions);
        drawUtilization();
      }
    }
  };
  if (mode[Maps.TravelMode.DRIVING]) {
    Directions.route({
      origin:      origin,
      destination: destination,
      travelMode:  Maps.TravelMode.DRIVING,
    }, dirfunc);
  }
  if (mode[Maps.TravelMode.BICYCLING]) {
    Directions.route({
      origin:      origin,
      destination: destination,
      travelMode:  Maps.TravelMode.BICYCLING,
    }, dirfunc);
  }

}


function fileChanged(event) {
  var csv = event.target.files[0];
  Papa.parse(csv, {
    step: function(results, parser) {
      var row = results.data[0];
      if (row[2]) {
        var trip = {
          id: parseInt(row[0]),
          start: {
            long: parseFloat(row[3]),
            lat:  parseFloat(row[4]),
            time: row[1],
            address: row[2],
          },
          end: {
            long: parseFloat(row[7]),
            lat:  parseFloat(row[8]),
            time: row[5],
            address: row[6],
          },
        };

        trips.push(trip);
      }
    },
    complete: function() {
      // sortByTime(trips);
      $('#prompt').empty();
      // for (var t = 0; t < trips.length; t++) {
      //     var index = t;
      //     $("ol#trip-list").append("<li data-index=\"" + index + "\">" + trips[t].start.address + "</li>");

      // }
      $("#trip-list").click(function(event) {
        var newID = $(event.toElement).attr("data-index");
        if (newID !== tripID) {
          tripID = newID;
          $("ol#trip-list li").css("opacity", "0.5");
          $(event.toElement).css("opacity", "1");
          tripChanged(trips[newID]);
        }
      });
    }
  });
  document.getElementById("bothBtn").disabled = false;
  document.getElementById("bikeBtn").disabled = false;
  document.getElementById("driveBtn").disabled = false;

}

window.onload = function() {
  document.getElementById("trip-file").addEventListener("change", fileChanged, false);
  //42.359456, -71.076336
  map = L.map('map-canvas', {zoomControl: false}).setView([42.359456, -71.076336], 14);
  L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
    maxZoom: 100,
    zoomControl: false,
    id: 'mapbox.dark',
    accessToken: 'pk.eyJ1IjoicGhsZWUwNjA4IiwiYSI6ImNqNXEyemV1YzBnazQyd3BxbnljNXcwZWgifQ.bDNLVHhQaQZou-OM0c9NKw'}).
    addTo(map);
    document.getElementById("trip-file").value = "";
    document.getElementById("bothBtn").disabled = true;
    document.getElementById("bikeBtn").disabled = true;
    document.getElementById("driveBtn").disabled = true;
  };



  var darkMap = [
    {
      "featureType": "all",
      "elementType": "labels.text.fill",
      "stylers": [
        {
          "saturation": 36
        },
        {
          "color": "#ffffff"
        },
        {
          "lightness": 40
        }
      ]
    },
    {
      "featureType": "all",
      "elementType": "labels.text.stroke",
      "stylers": [
        {
          "visibility": "on"
        },
        {
          "color": "#000000"
        },
        {
          "lightness": 16
        }
      ]
    },
    {
      "featureType": "all",
      "elementType": "labels.icon",
      "stylers": [
        {
          "visibility": "off"
        }
      ]
    },
    {
      "featureType": "administrative",
      "elementType": "geometry.fill",
      "stylers": [
        {
          "color": "#000000"
        },
        {
          "lightness": 20
        }
      ]
    },
    {
      "featureType": "administrative",
      "elementType": "geometry.stroke",
      "stylers": [
        {
          "color": "#000000"
        },
        {
          "lightness": 17
        },
        {
          "weight": 1.2
        }
      ]
    },
    {
      "featureType": "administrative.locality",
      "elementType": "labels.text",
      "stylers": [
        {
          "visibility": "off"
        }
      ]
    },
    {
      "featureType": "administrative.locality",
      "elementType": "labels.text.fill",
      "stylers": [
        {
          "visibility": "off"
        },
        {
          "hue": "#ff0000"
        }
      ]
    },
    {
      "featureType": "administrative.neighborhood",
      "elementType": "labels.text",
      "stylers": [
        {
          "visibility": "off"
        }
      ]
    },
    {
      "featureType": "landscape",
      "elementType": "geometry",
      "stylers": [
        {
          "color": "#000000"
        },
        {
          "lightness": 20
        }
      ]
    },
    {
      "featureType": "landscape",
      "elementType": "labels.text",
      "stylers": [
        {
          "visibility": "off"
        }
      ]
    },
    {
      "featureType": "landscape.natural",
      "elementType": "labels.text",
      "stylers": [
        {
          "visibility": "off"
        }
      ]
    },
    {
      "featureType": "poi",
      "elementType": "geometry",
      "stylers": [
        {
          "color": "#000000"
        },
        {
          "lightness": 21
        }
      ]
    },
    {
      "featureType": "poi",
      "elementType": "labels.text",
      "stylers": [
        {
          "visibility": "off"
        }
      ]
    },
    {
      "featureType": "road",
      "elementType": "all",
      "stylers": [
        {
          "visibility": "off"
        }
      ]
    },
    {
      "featureType": "road",
      "elementType": "geometry",
      "stylers": [
        {
          "visibility": "on"
        }
      ]
    },
    {
      "featureType": "road",
      "elementType": "geometry.fill",
      "stylers": [
        {
          "color": "#882425"
        },
        {
          "visibility": "on"
        }
      ]
    },
    {
      "featureType": "road.highway",
      "elementType": "geometry.fill",
      "stylers": [
        {
          "color": "#5c5c5c"
        },
        {
          "lightness": 17
        }
      ]
    },
    {
      "featureType": "road.highway",
      "elementType": "geometry.stroke",
      "stylers": [
        {
          "color": "#000000"
        },
        {
          "lightness": 29
        },
        {
          "weight": "0.20"
        }
      ]
    },
    {
      "featureType": "road.highway.controlled_access",
      "elementType": "geometry.fill",
      "stylers": [
        {
          "visibility": "on"
        },
        {
          "color": "#6e6e6e"
        }
      ]
    },
    {
      "featureType": "road.highway.controlled_access",
      "elementType": "geometry.stroke",
      "stylers": [
        {
          "weight": "0.89"
        }
      ]
    },
    {
      "featureType": "road.arterial",
      "elementType": "geometry",
      "stylers": [
        {
          "color": "#000000"
        },
        {
          "lightness": 18
        }
      ]
    },
    {
      "featureType": "road.arterial",
      "elementType": "geometry.fill",
      "stylers": [
        {
          "color": "#646464"
        },
        {
          "visibility": "on"
        }
      ]
    },
    {
      "featureType": "road.arterial",
      "elementType": "geometry.stroke",
      "stylers": [
        {
          "weight": "0.68"
        }
      ]
    },
    {
      "featureType": "road.local",
      "elementType": "geometry",
      "stylers": [
        {
          "color": "#000000"
        },
        {
          "lightness": 16
        }
      ]
    },
    {
      "featureType": "road.local",
      "elementType": "geometry.fill",
      "stylers": [
        {
          "color": "#5c5c5c"
        },
        {
          "visibility": "on"
        }
      ]
    },
    {
      "featureType": "road.local",
      "elementType": "geometry.stroke",
      "stylers": [
        {
          "weight": "0.68"
        }
      ]
    },
    {
      "featureType": "transit",
      "elementType": "geometry",
      "stylers": [
        {
          "color": "#000000"
        },
        {
          "lightness": 19
        }
      ]
    },
    {
      "featureType": "water",
      "elementType": "geometry",
      "stylers": [
        {
          "color": "#000000"
        },
        {
          "lightness": 17
        }
      ]
    }
  ]
