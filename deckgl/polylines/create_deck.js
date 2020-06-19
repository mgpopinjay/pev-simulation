'use strict';
const fs = require('fs');

let polyline = require("./polyline.js");
let sim_results = require('./sim_results_3546.json');

let trips = sim_results["fleet"];

//console.log(trips);


let routes = [];
let overview = []; // holds all coordinates from every trip

for (const [key, value] of Object.entries(trips)) {
	// console.log(key, value);
	let route;
	let trip = [];
	let pev = value["history"];
	for (route of pev) {
		// console.log(route);
		if ("overview_polyline" in route && "steps_polyline" in route) {
			let trip = polyline.decode(route["overview_polyline"]);
			
			//let overview = [];
			let point;
			for (point of trip) {
				//console.log(point);
				overview.push({"coordinates":point.reverse()});
			}
			
			routes.push(overview);
		}
	}
}

// console.log(routes);
console.log(overview);
let data = JSON.stringify(overview);
console.log(data);
fs.writeFileSync('overview.json', data);