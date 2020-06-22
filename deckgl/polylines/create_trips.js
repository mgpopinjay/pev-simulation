'use strict';
const fs = require('fs');

let polyline = require("./polyline.js");
let sim_results = require('./sim_results_7484.json');

let fleet = sim_results["fleet"];

for(var i = 0; i < 150; i++) { // remove most trips
	//delete fleet["" + i];
}

//console.log(trips);
function radians(degrees) {
	var pi = Math.PI;
	return degrees * (pi / 180);
}

function haversine(point1, point2) {
		let R = 6371000; // radius of earth in meters

    let dlat = radians(point2[1] - point1[1]);
    let dlon = radians(point2[0] - point1[0]);

    let lat1 = radians(point1[1]);
    let lat2 = radians(point2[1]);
    let lon1 = radians(point1[0]);
		let lon2 = radians(point2[0]);
	
    let a = (Math.sin(dlat / 2.0) ** 2) + Math.cos(lat1) * Math.cos(lat2) * (Math.sin(dlon / 2.0) ** 2);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    let dist = R * c;

    return dist;
}

let trips = [];

for (const [key, value] of Object.entries(fleet)) {
	// console.log(key, value);
	let route;
	let path = [];
	let timestamps = [];
	let pev = value["history"];
	for (route of pev) {
		// console.log(route);
		if ("steps_polyline" in route) {
			path = [];
			timestamps = [];
			for (const t of route["steps_polyline"]) {
				let r = polyline.decode(t);
				for (const s of r) {
					path.push(s.reverse());
				}
			}
			//path = polyline.decode(route["overview_polyline"]);
			let accumulated_time = route["start_time"];
			for (var i = 0; i < path.length; i++) {
				if (i == 0) {
					timestamps.push(accumulated_time);
				}
				else {
					let dist = haversine(path[i - 1], path[i]);
					if (route["distance"] != 0) {
						accumulated_time += (dist * route["duration"]) / route["distance"];
					}
					timestamps.push(accumulated_time);
				}
			}
			trips.push({"path":path, "timestamps":timestamps});
		}
	}
}

console.log(trips);
let data = JSON.stringify(trips);
//console.log(data);
fs.writeFileSync('trips.json', data);
