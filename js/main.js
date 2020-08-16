//main.js

//variable setting
var margin = {top:50, right:100, bottom:100, left:80}, //margins outside of graph (for axis and empty space around the graph)
    width = 1170 - margin.left - margin.right, //gragh width
    height = 900 - margin.top - margin.bottom, //graph height
    duration = 750,
    delay = 25,
    barHeight = 20;

//initial svg frame setting
var svg = d3.select("#chart-area")
    .append("svg") //svg connection to class in html file
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
    .append("g") //move graphing box for axises
        .attr("transform", "translate(" + margin.left + "," + margin.top +")");

//create background rectabgle. put this at very first step so otehr svg could be put on top of this svg element
//ref : https://github.com/d3/d3/issues/252
svg.append("rect")
    .attr("class", "background")
    .attr("width", width) //since it is background but want to have cursor event, so creating rect
    .attr("height", height)
    .attr("cursor","pointer")
    .on("click", up);

//color scheme
var color = d3.scaleOrdinal().range(["LightSlateGray", "#ccc"]);

//hiararchical function setting
var partition = d3.partition();

//scale
var x = d3.scaleLinear().range([0, width]);

//axis
var xAxis = d3.axisTop().scale(x);
svg.append("g").attr("class", "x axis");
svg.append("g").attr("class", "y axis").append("line").attr("y1","100%"); //% is length

//fix for format values at x for various magnutude
var formatSI = d3.format("$.2s") //SI-prefix with two significant digits (The International System of Units)
function formatAbbreviation(x) {
    var s = formatSI(x);
    switch (s[s.length - 1]) {
        case "G": return s.slice(0, -1) + "B"; //replace G with B
        case "k": return s.slice(0, -1) + "K"; //replace k with K
    }
    return s;
}

//load data
d3.json("data/flare.json", (error, root) => {
    if (error) throw error; //seems this is typical row for hierachical file
    console.log(root); //show raw dataset

    // before computing hierarchical layout, need a root node.
    // if the data is already hierarchical json, just pass it directly to d3.hierarchy
    // otherwise need rearrange tabular data to hierarchy using d3.stratify
    // this will create parent and child data on top of hierarchical data structure
    root = d3.hierarchy(root)
        .sum(d => d.size)
        .sort((a,b) => b.value - a.value);
    console.log(root);

    //lays out the specified root hierarchy assigning the following properties on root and descendants - node.x0, node.y0, node.x1, node.y1 - for rectangle
    //you must call root. sum before passing the hierarchy to the partition layout.
    //your probably also want to call root.sort to order the hierarchy before computing the layout
    partition(root);
    console.log(partition(root));

    //initial x axis domain
    x.domain([0, root.value]).nice(); //nice()typically convert to nice round numbers

    //initialize the x axis
    svg.selectAll(".x.axis")
        .call(xAxis.tickFormat(formatAbbreviation));

    down(root, 0); //root means passing data (called root), 0 means start with root node
});

//conprehensive drill down event
function down(d,i) {
    if (!d.children || this.__transition__) return;

    //set total transition duration
    var end = duration + d.children.length * delay;

    //mark any currently displayed bars as existing
    var exit = svg.selectAll(".enter")
        .attr("class", "exit");
    //entering nodes immediately obscure the clicked on bar, so hide it
    exit.selectAll("rect")
        .filter(p=>{return p === d; })
        .style("fill-opacity", 1e-6);

    //enter the new bars for the clicked on data.
    //per above, entering bars are immediately visible
    var enter = bar(d)
        .attr("transform", stack(i))
        .style("opacity", 1);

    //have the text fade-in, even though the bars are visible
    //color the tbars as parents; they will fade to children if appropriate
    enter.select("text").style("fill-opacity", 1e-6);
    enter.select("rect").style("fill", color(true));

    //update the x scale domain
    x.domain([0, d3.max(d.children, d=>{return d.value; })]).nice();

    //initialize or update the axis
    svg.selectAll(".x.axis")
        .transition().duration(duration)
        .transition().duration(duration)
        .call(xAxis.tickFormat(formatAbbreviation));

    //transition entering bars to their new position
    var enterTransition = enter.transition()
        .duration(duration)
        .transition()
        .duration(duration)
        .delay((d,i)=>{return i*delay; })
        .attr("transform", (d,i)=>{return "translate(0," + barHeight * i * 1.2 + ")"; });

    //transition entering text
    enterTransition.select("text")
        .style("fill-opacity", 1);

    //transition entering rects to the new x scale
    enterTransition.select("rect")
        .attr("width", d=>{return x(d.value); })
        .style("fill", d=>{return color(!!d.children); });

    //transition exiting bars to fade out
    var exitTransition = exit.transition()
        .duration(duration)
        .style("opacity", 1e-6)
        .remove();

    //transition exiting bars to the new x scale
    exitTransition.selectAll("rect")
        .attr("width", d=>{return x(d.value); });

    //rebind the current node to the background
    svg.select(".background")
            .datum(d)
        .transition()
            .duration(end);

    d.index = i;

}

//up function
function up(d) {
    if (!d.parent || this.__transition) return;

    var end = duration + d.children.length * delay;

    //mark any currently displayed bars as exiting
    var exit = svg.selectAll(".enter")
        .attr("class", "exit");

    //enter the new bars for the clicked on data's parent
    var enter = bar(d.parent)
        .attr("transform", (d,i)=>{return "translate(0," + barHeight * i * 1.2 + ")"; })
        .style("opacity", 1e-6);

    //color the bars as appropriate
    //exiting nodes will obscure the parent bar, so hide it
    enter.select("rect")
            .style("fill", d=>{return color(!!d.children); })
        .filter(p=>{return p === d; })
            .style("fill-opacity", 1e-6);

    //update the x scale domain
    x.domain([0, d3.max(d.parent.children, d=>{return d.value; })]).nice();

    //update the x axis
    svg.selectAll(".x.axis").transition()
        .duration(duration)
        .call(xAxis);

    //transition entering bars to fade in over the full duration
    var enterTransition = enter.transition()
        .duration(end)
        .style("opacity", 1);

    //transition entering rects to the new x scale
    //when the entering parent rect is done, make it visible
    enterTransition.select("rect")
        .attr("width", d=>{return x(d.value); })
        .on("end", function(p){ if ( p === d ) d3.select(this).style("fill-opacity", null); });

    //transition exiting bars to the parents' position
    var exitTransition = exit.selectAll("g").transition()
        .duration(duration)
        .delay((d,i)=>{return i * delay; })
        .attr("transform", stack(d.index));

    //transition exiting text to fade out
    exitTransition.select("text")
        .style("fill-opacity", 1e-6);

    //transition exiting rects to the new scale and fade to parent color
    exitTransition.select("rect")
        .attr("width", d=>{return x(d.value); })
        .style("fill", color(true));

    //remove exiting nodes when the last child has finished transitioning
    exit.transition()
        .duration(end)
        .remove();

    //rebind the current parent to the background
    svg.select(".background")
            .datum(d.parent)
        .transition()
            .duration(end);
}

//creates a set of bars for the given data node, at the specified index
function bar(d){
    var bar = svg.insert("g", ".y.axis")
            .attr("class", "enter") 
            .attr("transform", "translate(0,5)")
        .selectAll("g")
            .data(d.children)
        .enter().append("g")
            .style("cursor", function(d){return !d.children ? null : "pointer"; })
            .on("click", down);

    //each bar label
    bar.append("text")
        .attr("x", -6) //offset x
        .attr("y", barHeight/2) //offset y
        .attr("dy", ".35em") //dx and dy are relative coordinate against x and y, while x and y are absolute coordinates
        .style("text-anchor", "end")
        .text(d=>{return d.data.name; })
        .attr("font-size", 10)
        .attr("fill", "Black"); //font size ties to body/bootstrap

    //bar set
    bar.append("rect")
        .attr("width", d=>{return x(d.value); })
        .attr("height", barHeight)
        .append("title") //simple tooltip
        .text(d=>{return d.data.name + " : " + formatAbbreviation(d.value);}); //simple tooltip

    return bar;
}

//a stateful closure for stacking bars horizontally
function stack(i){
    var x0=0;
    return d => {
        var tx = "translate(" + x0 + "," + barHeight * i *1.2 + ")";
        x0 += x(d.value);
        return tx;
    };
}

//to do
//stagger
//hilite bar where point is placed
//change data to csv