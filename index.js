var kmlTemplateStart = '<?xml version="1.0" encoding="UTF-8"?>\
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>\
	<name>$name</name>\
	<description>Mission trajectory</description>\
	<Style id="hazardStyle">\
		<LineStyle>\
			<color>ff0000ff</color>\
			<width>4</width>\
		</LineStyle>\
		<PolyStyle>\
			<color>3f0000ff</color>\
		</PolyStyle>\
	</Style>';

var kmlTemplateEnd = '	</Document></kml>';

var hazardTemplate = '<Placemark> \
	<name>Hazard zone</name>\
	<Polygon> <outerBoundaryIs>  <LinearRing>\
		<coordinates>$coordinates</coordinates>\
	</LinearRing> </outerBoundaryIs> </Polygon>\
	<styleUrl>#hazardStyle</styleUrl>\
</Placemark>';

var placemarkTemplate = '<Placemark>\
	<name>$name</name>\
	<Style>\
		<LineStyle>\
			<color>$color</color>\
			<width>10</width>\
		</LineStyle>\
	</Style>\
	<LineString>\
		<altitudeMode>absolute</altitudeMode>\
		<coordinates>$coordinates</coordinates>\
	</LineString>\
</Placemark>';

var blanks = function(a){return a.charAt(0) != '#' && a.charAt(0) != '-' && a.charAt(1) != '-' && a !== "";};
Cesium.Color.FADEDCYAN   = new Cesium.Color(0, 1, 1, .5);
Cesium.Color.FADEDRED    = new Cesium.Color(1, 0, 0, .5);
Cesium.Color.FADEDORANGE = new Cesium.Color(1,.5, 0, .5);

var vehicles = {
	"F9": [{"name":"UpperStage", "color":"CYAN"}, {"name":"Booster", "color":"RED"},
		{failure: true, "name":"UpperStage_planned", "color":"FADEDCYAN"}, {failure: true, "name":"Booster_planned", "color":"FADEDRED"}],
	"FH": [{"name":"UpperStage", "color":"CYAN"}, {"name":"Core", "color":"LIGHTGREEN"}, {"name":"Booster", "color":"RED"}]
};

function formatTime(seconds) {
	var hours = Math.floor(seconds / 3600);
	seconds -= hours * 3600;
	var minutes = Math.floor(seconds / 60);
	seconds -= minutes * 60;
	return "T+" + (hours > 9 ? hours : ("0" + hours)) + ":" +
		(minutes > 9 ? minutes : ("0" + minutes)) + ":" +
		(seconds > 9 ? seconds : ("0" + seconds));
}

function addHazard(coords) {
	if (coords.length === 0) return;
	viewer.entities.add({
		name : 'Hazard',
		polygon : {
			hierarchy : Cesium.Cartesian3.fromDegreesArray(coords.reduce(function(a, b) { return a.concat(b);}, [])),
			material : Cesium.Color.RED.withAlpha(0.25),
			outline : true,
			outlineColor : Cesium.Color.RED
		}
	});
	kml.push(hazardTemplate.replace("$coordinates", coords.map(function(coord) { return coord[0] + ","+ coord[1] + ",0"; }).join("\n")));
}

function formatMeters(title, value) {
	return title + ": " + (value < 1000 ? value + " m" : Math.floor(value / 1000) + " km");
}

function formatColor(color) {
	var alpha = Math.floor(color.alpha * 255),
		red = Math.floor(color.red * 255),
		green = Math.floor(color.green * 255),
		blue = Math.floor(color.blue * 255);

	return (alpha > 15 ? "" : "0") + alpha.toString(16) + 
		(blue  > 15 ? "" : "0") + blue.toString(16) +
		(green > 15 ? "" : "0") + green.toString(16) +
		(red   > 15 ? "" : "0") + red.toString(16);
}

var player = null;
// YouTube API stub for missions without videos
var pseudoPlayer = {
	time: 0,
	length: 1800,
	playing: false,
	// advances when interrogated by the video thread so we don't need to kick off another thread to increment time
	getCurrentTime: function() {
		if (this.playing) {
			this.setCurrentTime(this.time + 1);
		}
		return (this.time);
	},
	setCurrentTime: function (time) {
		this.time = Math.min(this.length, time);
		$("#pseudoPlayer .progress-bar").css("width", this.time * 100 / this.length + "%").text(formatTime(this.time));
	},
	setPlaying: function (playing) {
		this.playing = playing;
		$("#pseudoPlayer").toggleClass("playing", playing);
	},
	destroy: function() {
		this.setCurrentTime(0);
		this.setPlaying(false);
	}
};
var interval = null;
var kml = null;

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
		// hack-around because Cesium doesn't clean up well
		viewer.dataSourceDisplay._defaultDataSource._visualizers[11] = new Cesium.LabelVisualizer(viewer.scene, viewer.entities)
		viewer.dataSourceDisplay._defaultDataSource._visualizers[13] = new Cesium.PointVisualizer(viewer.scene, viewer.entities)
	}
	// XHR the data files, parse and display
	document.title = "Boostback | " + missionName;
	missionName = missionName.replace(/ /g, "_");
	kml = [kmlTemplateStart.replace("$name", missionName)];
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
				coords.push([+point[0], +point[1]]);
			}
		}
		addHazard(coords);
	});

	var stageModel = [], count = 0;
	var callback = function() {
		count += 1;
		if (count === stages.length) {
			// point camera at launch pad
			stageModel.sort(function(a, b) { return a.start > b.start; });
			viewer.scene.camera.lookAt(stageModel[0].points[0], new Cesium.HeadingPitchRange(0, -Math.PI/3, 1000000));
			viewer.scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

			// generate KML file blob
			kml.push(kmlTemplateEnd);
			var blob = new Blob(kml);
			$("#downloadKML").prop("href", window.URL.createObjectURL(blob)).prop("download", missionName + ".kml");
		}
	}

	stages.forEach(function(stage) {
		$.ajax({
			url: missionName + "/" + stage.name + ".dat"
		}).done(function(response) {
			var lines = response.split("\n").filter(blanks);
			var maxQ = { value: 0 };
			var points = lines.map(function(line, idx) {
				var tokens = line.split("\t");
				// undo the lat/lon -> xyz transform from FlightClub - it seems to be spherical rather than ellipsoidal
				var relPos = [ +tokens[1], +tokens[2], +tokens[3] ];
				var latitude = Math.PI / 2 - Math.atan2(Math.sqrt(relPos[0] * relPos[0] + relPos[1] * relPos[1]), relPos[2]);
				var longitude = Math.atan2(relPos[1], relPos[0]);
				// Cesium converts back to xyz anyway, but we'll get better positioning this way
				var coord = Cesium.Cartesian3.fromRadians(longitude, latitude, tokens[4] * 1000);
				coord.latitude = latitude * 180 / Math.PI;
				coord.longitude = longitude * 180 / Math.PI;
				coord.throttle  = +tokens[12];
				coord.altitude  = tokens[4] * 1000;
				coord.downrange = tokens[6] * 1000;
				var q = +tokens[7];
				// arbitrarily restrict max-q lookup to first two minutes so we don't get pressure from re-entry/landing
				if (q > maxQ.value && idx < 120) {
					maxQ.value = q;
					maxQ.point = coord;
				}
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

			kml.push(placemarkTemplate.replace("$name", stage.name)
				.replace("$color", formatColor(Cesium.Color[stage.color]))
				.replace("$coordinates", points.map(function(p) {
					return p.longitude + "," + p.latitude + "," + p.altitude;
				}).join("\n")));

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

			// add max Q indicator:
			if (maxQ.value > 0) {
				viewer.entities.add({
					position: maxQ.point,
					point: { pixelSize: 10 },
					label: {
						text: "Max Q",
						font: '12pt sans-serif',
						horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
						pixelOffset: new Cesium.Cartesian2(15, 0)
					}
				})
			}

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
		ytapi.done(function() {
			player = new YT.Player('launchPlayer', { videoId: video.url });
		});
	} else {
		// stub out the video and player
		video = { start: 0 };
		player = pseudoPlayer;
		$("#launchPlayer").addClass("active");
	}
	interval = setInterval(function() {
		if (player == null) return;
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
	}, 1000);
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

// Initialize map
var viewer = new Cesium.Viewer('cesiumContainer', {
	timeline: false,
	skyAtmosphere: false,
	animation: false,
	scene3DOnly: true,
	fullscreenButton: false,
	geocoder: false
});

$("#f9missions").on("loadMission", "a", missionLoader(vehicles.F9));
$("#fhmissions").on("loadMission", "a", missionLoader(vehicles.FH));

// add play controls if we don't have a youtube video
$("#restart").on("click", function() { pseudoPlayer.setCurrentTime(0); });
$("#play").on("click",    function() { pseudoPlayer.setPlaying(true); });
$("#pause").on("click",   function() { pseudoPlayer.setPlaying(false); });

$(window).on("hashchange", function() {
	$(window.location.hash).trigger("loadMission");
}).trigger("hashchange");

