/**
 * Prepares the data sets for the graph by rounding off and
 * counting the number of occurances of each waittime
 * @param  {[int]} times    [list of waittimes]
 * @return {obj}   dataset  [object with waittimed (by 5) mapped to number of occurances]
 */
function prepareDataSets(times) {
  function round5(x) {
    return (x % 5) >= 2.5 ? parseInt(x / 5) * 5 + 5 : parseInt(x / 5) * 5;
  }
  let dataset = [];
  let data = {};
  times.forEach(time => {
    let t = round5(time) > 35 ? 35 : round5(time);
    if (data[t]) {
      data[t] += 1;
    } else {
      data[t] = 1;
    }
  })
  Object.keys(data).forEach(key => {
    dataset.push({
      key: key,
      value: data[key],
    })
  })
  return dataset
}


function barGraph(dataset, id, color) {
  var w = 120;
  var h = 80;

  var parcel_color = "#FF9900";
  var passenger_color = "#FFCC00";

  var key = function(d) {
    return d.key;
  };

  var xScale = d3.scale.ordinal()
      .domain(d3.range(0, 40, 5))
      .rangeRoundBands([0, w], 0.05);

  var yScale = d3.scale.linear()
      .domain([0, d3.max(dataset, function(d) {return d.value;})])
      .range([0, h]);

  d3.select(id).select("svg").remove();
  var svg = d3.select($(id)[0])
      .append("svg")
      .attr("width", w)
      .attr("height", h+40);

  svg.selectAll("rect")
    .data(dataset, key)
    .enter()
    .append("rect")
    .attr("x", function(d, i) {
      return xScale(d.key);
    })
    .attr("y", function(d) {
      return h - yScale(d.value);
    })
    .attr("width", xScale.rangeBand())
    .attr("height", function(d) {
      return yScale(d.value);
    })
    .attr("fill", color)

  //Create labels
  svg.selectAll("text")
  .data(dataset, key)
  .enter()
  .append("text")
  .text(function(d) {
    if (d.value == 0) return "";
    return d.value;
  })
  .attr("text-anchor", "middle")
  .attr("x", function(d, i) {
    return xScale(5*i) + xScale.rangeBand() / 2;
  })
  .attr("y", function(d) {
    return h - yScale(d.value) + 12;
  })
  .attr("font-family", "sans-serif")
  .attr("font-size", "11px")
  .attr("fill", "white")
  .attr("transform", "translate(0,-15)");

  var xAxis = d3.svg.axis()
  .scale(xScale)
  .tickSize(0)
  .tickPadding(6)
  .orient("bottom");

  svg.append("g")
  .call(xAxis)
  .attr("transform", "translate(0, 90)")
  .attr("class", "x axis")
  .attr("fill", "white");

  function drawPersonWaitTime(dataset) {
    yScale = d3.scale.linear()
    .domain([0, d3.max(dataset, function(d) {return d.value;})])
    .range([0, h]);

    //Create bars
    svg.selectAll("rect")
    .data(dataset, key)
    .attr("x", function(d, i) {
      return xScale(d.key);
    })
    .attr("y", function(d) {
      return h+20 - yScale(d.value);
    })
    .attr("width", xScale.rangeBand())
    .attr("height", function(d) {
      return yScale(d.value);
    })
    .attr("fill", color)

      //Create labels
      svg.selectAll("text")
      .data(dataset, key)
      .text(function(d) {
        if (d.value == 0) return "";
        return d.value;
      })
      .attr("text-anchor", "middle")
      .attr("x", function(d, i) {
        return xScale(5*i) + xScale.rangeBand() / 2;
      })
      .attr("y", function(d) {
        return h+20 - yScale(d.value) + 14;
      })
      .attr("font-family", "sans-serif")
      .attr("font-size", "11px")
      .attr("fill", "white")
      .attr("transform", "translate(0,-25)");
  }
}
