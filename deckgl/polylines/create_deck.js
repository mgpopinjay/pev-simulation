'use strict';
const fs = require('fs');

let polyline = require("./polyline.js");
let sim_results = require('./sim_results_3546.json');

let trips = sim_results["fleet"];

//console.log(trips);


let routes = [];
let overview = []; // holds all coordinates from every trip
for(var i = 0; i < 207; i++) { // remove most trips
	delete trips["" + i];
}

for (const [key, value] of Object.entries(trips)) {
	// console.log(key, value);
	let route;
	let trip = [];
	let pev = value["history"];
	for (route of pev) {
		// console.log(route);
		if ("overview_polyline" in route && "steps_polyline" in route) {
			//let trip = polyline.decode(route["overview_polyline"]);
			trip = [];
			for (const t of route["steps_polyline"]) {
				let r = polyline.decode(t);
				for (const s of r) {
					console.log(s);
					trip.push(s);
				}
			}
			let trip2 = polyline.decode(route["overview_polyline"])
			
			//let overview = [];
			let point;
			let color = [Math.floor((Math.random() * 255) + 1), Math.floor((Math.random() * 255) + 1), Math.floor((Math.random() * 255) + 1)];
			for (point of trip) {
				console.log("Point:" + point);
				overview.push({"coordinates":point.reverse(), "color":color});
			}
			color = [Math.floor((Math.random() * 255) + 1), Math.floor((Math.random() * 255) + 1), Math.floor((Math.random() * 255) + 1)];
			for (point of trip2) {
				console.log("Point:" + point);
				overview.push({"coordinates":point.reverse(), "color":color});
			}
			
			routes.push(overview);
		}
	}
}

console.log(routes);
console.log(overview);
let data = JSON.stringify(overview);
console.log(data);
fs.writeFileSync('overview.json', data);
