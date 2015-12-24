var viewer = new Cesium.Viewer('cesiumContainer', {
	timeline: false,
	skyAtmosphere: false,
	animation: false,
	scene3DOnly: true
});
var blanks = function(a){return a.charAt(0) != '#' && a !== "";};
var parseStageLine = function(line) {
	var tokens = line.split("\t");
	var relPos = [+tokens[1], +tokens[2], +tokens[3]];
    var tempBeta = [0, 0, 0];
    tempBeta[1] = Math.PI - Math.atan2(Math.sqrt(relPos[0] * relPos[0] + relPos[1] * relPos[1]), relPos[2]);
    tempBeta[2] = Math.PI + Math.atan2(relPos[1], relPos[0]);
    var _longitude2 = tempBeta[1];
    var psi2 = tempBeta[2] - Math.PI;
	
	return [psi2, _longitude2 - Math.PI / 2, tokens[4] * 1000];
};
function addHazard(coords) {
	if (coords.length === 0) return;
	viewer.entities.add({
	  name : 'Hazard',
	  polygon : {
		hierarchy : Cesium.Cartesian3.fromDegreesArray(coords),
		material : Cesium.Color.RED.withAlpha(0.25),
		outline : true,
		outlineColor : Cesium.Color.RED
	  }
	});
}

function loadMission(missionName, stages) {
	viewer.entities.removeAll();
	missionName = missionName.replace(/ /g, "_");
	var haz = new XMLHttpRequest();
	haz.open("GET", missionName + "/hazard.txt", true);
	haz.onreadystatechange = function() {
		if (this.status == 200 && this.readyState == 4) {
			var coords = [];
			var points = this.responseText.split("\n")

			for (var i = 0; i < points.length; i++) {
				if (points[i] == "") {
					addHazard(coords);
					coords = [];
				} else {
					var point = points[i].split(/\s+/);
					coords.push(+point[0]);
					coords.push(+point[1]);
				}
			}
			addHazard(coords);
		}
	};
	haz.send(null);

	stages.forEach(function(stage) {
		var xhr = new XMLHttpRequest();
		xhr.open("GET", missionName + "/" + stage.name + ".dat", true);
		xhr.onreadystatechange = function() {
			if (this.status === 200 && this.readyState === 4) {
				var points = this.responseText.split("\n").filter(blanks).map(parseStageLine);
				viewer.entities.add({
					polyline : {
						positions : Cesium.Cartesian3.fromRadiansArrayHeights(points.reduce(function(a, b) { return a.concat(b);}, [])),
						width : 3,
						material : Cesium.Color[stage.color]
					}
				});
			}
		};
		xhr.send(null)
	});

};

document.getElementsByTagName("nav")[0].onclick = function(event) {
	if (event.target.tagName.toLowerCase() === "input") {
		loadMission(event.target.value, JSON.parse(event.target.getAttribute("data-stages")));
	}
};

