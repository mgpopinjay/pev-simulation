var polyline = require("./polyline.js")
let json = require('./polyline.json')

console.log(polyline)
console.log(polyline.decode(json["overview_polyline"]))