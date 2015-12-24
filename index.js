var viewer = new Cesium.Viewer('cesiumContainer', {
	timeline: false,
	skyAtmosphere: false,
	animation: false,
	scene3DOnly: true
});
var blanks = function(a){return a.charAt(0) != '#' && a.charAt(0) != '-' && a !== "";};
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
	viewer.scene.primitives.removeAll();
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
				var lines = this.responseText.split("\n").filter(blanks);
				var colors = lines.map(stage.name === "UpperStage" ?
					function(line) { return Cesium.Color[stage.color]; } :
					function(line) { var num = +line.split("\t")[12]; var color = (num > .5) ? Cesium.Color.ORANGE : Cesium.Color[stage.color];console.log(color.toString()); return color; });
				var points = lines.map(parseStageLine);
				points = points.reduce(function(a,b) { return a.concat(b); }, []);
				points = Cesium.Cartesian3.fromRadiansArrayHeights(points);

				var primitive = new Cesium.Primitive({
					geometryInstances : new Cesium.GeometryInstance({
						geometry : new Cesium.PolylineGeometry({
							positions : points,
							width : 3,
							vertexFormat : Cesium.PolylineColorAppearance.VERTEX_FORMAT,
							colors: colors,
							colorsPerVertex: true
						})
					}),
					appearance : new Cesium.PolylineColorAppearance({
						translucent : false
					})
				});

				viewer.scene.primitives.add(primitive);
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

