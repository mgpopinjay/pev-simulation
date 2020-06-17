'use strict';
const fs = require('fs');

let polyline = require("./polyline.js");
let sim_results = require('./sim_results_3546.json');

let trips = sim_results["fleet"]["0"]["history"];

console.log(trips);
/*
let routes = [];
let route;

for (route of ) {
	let overview = [];
	let point;

	for (point of route) {
		console.log(point);
		overview.push({"coordinates":point.reverse()});
	}
	
}

console.log(routes);
let data = JSON.stringify(overview);
console.log(data);
fs.writeFileSync('overview.json', data);
*/
