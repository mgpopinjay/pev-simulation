'use strict';
const fs = require('fs');

let polyline = require("./polyline.js");
let json = require('./polyline.json');

console.log(polyline);
let waypoints = polyline.decode(json["overview_polyline"]);
console.log(waypoints);

let overview = [];
let point;

for (point of waypoints) {
	console.log(point);
	overview.push({"coordinates":point.reverse()});
}
console.log(overview);
let data = JSON.stringify(overview);
console.log(data);
fs.writeFileSync('overview.json', data);
