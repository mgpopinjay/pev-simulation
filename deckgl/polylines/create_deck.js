'use strict';
const fs = require('fs');

let polyline = require("./polyline.js");
let sim_results = require('./sim_results_3546.json');

let trips = sim_results["fleet"]["0"]["history"];

//console.log(trips);


let routes = [];
let route;
let trip = [];
let overview = [];

for (route of trips) {
	if ("overview_polyline" in route && "steps_polyline" in route) {
		let trip = polyline.decode(route["overview_polyline"]);

		//let overview = [];
		let point;
		//console.log(trip);
		for (point of trip) {
			//console.log(point);
			overview.push({"coordinates":point.reverse()});
			//console.log(overview);
		}

		routes.push(overview);
	}
}

console.log(routes);
let data = JSON.stringify(overview);
console.log(data);
fs.writeFileSync('overview.json', data);
