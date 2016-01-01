var viewer = new Cesium.Viewer('cesiumContainer', {
	timeline: false,
	skyAtmosphere: false,
	animation: false,
	scene3DOnly: true,
	fullscreenButton: false,
	geocoder: false
});
var blanks = function(a){return a.charAt(0) != '#' && a.charAt(0) != '-' && a.charAt(1) != '-' && a !== "";};
Cesium.Color.FADEDCYAN   = new Cesium.Color(0, 1, 1, .5);
Cesium.Color.FADEDRED    = new Cesium.Color(1, 0, 0, .5);
Cesium.Color.FADEDORANGE = new Cesium.Color(1,.5, 0, .5);
var vehicles = {
	"F9": [{"name":"UpperStage", "color":"CYAN"}, {"name":"Booster", "color":"RED"}, {failure: true, "name":"UpperStage_planned", "color":"FADEDCYAN"}, {failure: true, "name":"Booster_planned", "color":"FADEDRED"}],
	"FH": [{"name":"UpperStage", "color":"CYAN"}, {"name":"Core", "color":"LIGHTGREEN"}, {"name":"Booster", "color":"RED"}]
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

function formatMeters(title, value) {
	return title + ": " + (value < 1000 ? value + " m" : value / 1000 + " km");
}

var player = null;
var interval = null;

function loadMission(missionName, stages, append, video) {
	// Clean up previous mission - remove everything from the map, tear down the video player
	if (interval != null) {
		clearInterval(interval);
		interval = null;
	}
	if (player != null) {
		player.destroy();
		player = null;
	}
	if (!append) {
		viewer.entities.removeAll();
		viewer.scene.primitives.removeAll();
		// hack-around because Cesium doesn't clean up Points well
		viewer.dataSourceDisplay._defaultDataSource._visualizers[13] = new Cesium.PointVisualizer(viewer.scene, viewer.entities)
	}
	// XHR the data files, parse and display
	document.title = "Boostback | " + missionName;
	missionName = missionName.replace(/ /g, "_");
	$.ajax({
		url: missionName + "/hazard.txt",
	}).done(function(response) {
		var coords = [], points = response.split("\n");

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
	});

	var stageModel = [], count = 0;
	var callback = function() {
		count += 1;
		if (count === stages.length) {
			stageModel.sort(function(a, b) { return a.start > b.start; });
			viewer.scene.camera.lookAt(stageModel[0].points[0], new Cesium.HeadingPitchRange(0, -Math.PI/3, 1000000));
			viewer.scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
		}
	}

	stages.forEach(function(stage) {
		$.ajax({
			url: missionName + "/" + stage.name + ".dat"
		}).done(function(response) {
			var lines = response.split("\n").filter(blanks);
			var points = lines.map(function(line) {
				var tokens = line.split("\t");
				// undo the lat/lon -> xyz transform from FlightClub - it seems to be spherical rather than ellipsoidal
				var relPos = [ +tokens[1], +tokens[2], +tokens[3] ];
				var _longitude2 = Math.PI - Math.atan2(Math.sqrt(relPos[0] * relPos[0] + relPos[1] * relPos[1]), relPos[2]);
				var psi2 = Math.atan2(relPos[1], relPos[0]);
				// Cesium converts back to xyz anyway, but we'll get better positioning this way
				var coord = Cesium.Cartesian3.fromRadians(psi2, _longitude2 - Math.PI / 2, tokens[4] * 1000);
				coord.throttle  = +tokens[12];
				coord.altitude  = tokens[4] * 1000;
				coord.downrange = tokens[6] * 1000;
				return (coord);
			});
			// TODO - nicer highlighting of throttle in the path
			var colors = points.map(function(point) {
				if (point.throttle > .5) {
					return stage.failure ? Cesium.Color.FADEDORANGE : Cesium.Color.ORANGE;
				} else {
					return Cesium.Color[stage.color];
				}
			});

			stageModel.push({
				start: parseInt(lines[0], 10),
				points: points,
				point: viewer.entities.add({
					name: stage.name,
					show: false,
					position: points[0],
					point: {
						pixelSize: 10
					},
					label: {
						show: false,
						font: '12pt sans-serif',
						horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
						pixelOffset: new Cesium.Cartesian2(15, 0)
					}
				})
			});
			callback();

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
					translucent : true
				})
			});

			viewer.scene.primitives.add(primitive);
		}).error(callback);
	});

	if (video) {
		player = new YT.Player('launchPlayer', { videoId: video.url });
		interval = setInterval(function() {
			if (player != null) {
				var seconds = Math.floor(player.getCurrentTime()) - video.start;
				for (var i = 0; i < stageModel.length; i++) {
					stageModel[i].point.show = true;
					stageModel[i].point.label.show = true;
					stageModel[i].point.point.color = Cesium.Color.WHITE;
					if (seconds < stageModel[i].start) { // before separation
						if (i > 0) {
							stageModel[i].point.position = stageModel[i - 1].point.position;
							stageModel[i].point.point.color = stageModel[i - 1].point.point.color;
						}
						stageModel[i].point.label.show = false;
					} else if (seconds > stageModel[i].start + stageModel[i].points.length) { // after video
						var pos = stageModel[i].points[stageModel[i].points.length - 1];
						stageModel[i].point.position = pos;
						stageModel[i].point.label.text = formatMeters("Altitude", pos.altitude) + "\n" +
												formatMeters("Downrange", pos.downrange);
						
					} else {
						var pos = stageModel[i].points[seconds - stageModel[i].start];
						stageModel[i].point.position = pos;
						stageModel[i].point.label.text = formatMeters("Altitude", pos.altitude) + "\n" +
												formatMeters("Downrange", pos.downrange);
						if (pos.throttle > .5) {
							stageModel[i].point.point.color = Cesium.Color.ORANGE;
						}
					}
				}
			}
		}, 1000);
	}
};

function missionLoader(vehicle) {
	return function (event) {
		event.preventDefault();
		var el = $(this), video;
		if (this.hasAttribute("data-video")) {
			video = {url: el.data("video"), start: el.data("start") || 0 };
		}
		loadMission(this.id, vehicle, false, video);
	}
}

$("#f9missions").on("loadMission", "a", missionLoader(vehicles.F9));
$("#fhmissions").on("loadMission", "a", missionLoader(vehicles.FH));

$(window).on("hashchange", function() {
	$(window.location.hash).trigger("loadMission");
}).trigger("hashchange");

