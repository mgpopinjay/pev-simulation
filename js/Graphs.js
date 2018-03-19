function lineGraph(id, maxx, maxy, width, height) {
    // define dimensions of graph
    var m = [20, 20, 20, 20]; // margins
    var w = width - m[1] - m[3]; // width
    var h = height - m[0] - m[2]; // height
    // create a simple data array that we'll plot with a line (this array represents only the Y values, X will just be the index location)
    // X scale will fit all values from data[] within pixels 0-w
    var x = d3.scale.linear().domain([0, maxx]).range([0, w]);
    // var x = d3.scale.linear().domain([0, data.length]).range([0, w]);
    // Y scale will fit values from 0-10 within pixels h-0 (Note the inverted domain for the y-scale: bigger is up!)
    var y = d3.scale.linear().domain([0, maxy]).range([h, 0]);
    // automatically determining max range can work something like this
    // var y = d3.scale.linear().domain([0, d3.max(data)]).range([h, 0]);
    // create a line function that can convert data[] into x and y points

    // Add an SVG element with the desired dimensions and margin.
    var graph = d3.select("#graphs").append("svg:svg")
          .attr("width", w + m[1] + m[3])
          .attr("height", h + m[0] + m[2])
          .attr("id", id)
          .attr("w", w)
          .attr("h", h)
          .attr("maxx", maxx)
          .attr("maxy", maxy)
        .append("svg:g")
          .attr("id", id + "-container")
          .attr("transform", "translate(" + m[3] + "," + m[0] + ")");
    // create yAxis
    var xAxis = d3.svg.axis().scale(x).tickSize(-h).tickSubdivide(true);
    // Add the x-axis.
    graph.append("svg:g")
          .attr("class", "x axis")
          .attr("fill", "white")
          .attr("transform", "translate(0," + h + ")")
          .call(xAxis);
    graph.selectAll("text")
          .attr("y", "10")
          .attr("font-size", "12px");
    // create left yAxis
    var yAxisLeft = d3.svg.axis().scale(y).ticks(4).orient("left");
    // Add the y-axis to the left
    graph.append("svg:g")
          .attr("class", "y axis")
          .attr("transform", "translate(-25,0)")
          .call(yAxisLeft);
}

function addLine(data, id, trial, coloroverride) {
    let colors = ["#FFCC00", "#F0F000", "#B2B2B2"]
    let colorindex = trial > 2 ? 2 : trial;
    let color = coloroverride ? coloroverride : colors[colorindex];
    let g = d3.select("#" + id);
    let w = g.attr("w")
    let h = g.attr("h")
    let maxx = g.attr("maxx")
    let maxy = g.attr("maxy")
    var x = d3.scale.linear().domain([0, maxx]).range([0, w]);
    var y = d3.scale.linear().domain([0, maxy]).range([h, 0]);

    var line = d3.svg.line()
      // assign the X function to plot our line as we wish
      .x(function(d,i) {
        // return the X coordinate where we want to plot this datapoint
        return x(i);
      })
      .y(function(d) {
        // return the Y coordinate where we want to plot this datapoint
        return y(d);
      })
     .interpolate("basis");
    let graph = d3.select("#" + id + "-container");
    let check = graph.select("#line-" + trial).remove();

    // if (check[0][0]) {
    //   console.log("FOUND")
    // } else {
    //   console.log("NOTFOUND")
    // }

    // Add the line by appending an svg:path element with the data line we created above
    // do this AFTER the axes above so that the line is above the tick-lines
    graph.append("svg:path")
          .attr("id", "line-" + trial)
          .attr("d", line(data))
          .attr("stroke", color)
          .attr("stroke-width", 3)
          .attr("fill", "none");
}
