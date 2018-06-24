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
WorldWind.Color.FADEDCYAN   = new WorldWind.Color(0, 1, 1, .5);
WorldWind.Color.FADEDRED    = new WorldWind.Color(1, 0, 0, .5);
WorldWind.Color.ORANGE = new WorldWind.Color(1,.5, 0);
WorldWind.Color.FADEDORANGE = new WorldWind.Color(1,.5, 0, .5);

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
	/*viewer.entities.add({
		name : 'Hazard',
		polygon : {
			hierarchy : Cesium.Cartesian3.fromDegreesArray(coords.reduce(function(a, b) { return a.concat(b);}, [])),
			material : WorldWind.Color.RED.withAlpha(0.25),
			outline : true,
			outlineColor : WorldWind.Color.RED
		}
	});*/
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
var pathsLayer = new WorldWind.RenderableLayer();
pathsLayer.displayName = "Paths";

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
		pathsLayer.removeAllRenderables();
	}
	var uuid = /^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(missionName);
	document.title = uuid ? "Boostback" : ("Boostback | " + missionName);
	kml = [kmlTemplateStart.replace("$name", missionName)];
	if (!uuid) {
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
					coords.push([+point[0], +point[1]]);
				}
			}
			addHazard(coords);
		});
	}

	stageModel = [];
	var count = 0;
	var callback = function() {
		count += 1;
		if (count === stages.length) {
			// point camera at launch pad
			stageModel.sort(function(a, b) { return a.start > b.start; });
			// TODO: point camera at launch site

			// generate KML file blob
			kml.push(kmlTemplateEnd);
			var blob = new Blob(kml);
			$("#downloadKML").prop("href", window.URL.createObjectURL(blob)).prop("download", missionName + ".kml");
		}
	}

	stages.forEach(function(stage) {
		$.ajax({
			url: uuid ? ("http://www.flightclub.io/output/" + missionName + "_" + stage.name + ".dat") : (missionName + "/" + stage.name + ".dat")
		}).done(function(response) {
			var lines = response.split("\n").filter(blanks);
			var points = lines.map(function(line, idx) {
				var tokens = line.split("\t");
				// undo the lat/lon -> xyz transform from FlightClub - it seems to be spherical rather than ellipsoidal
				var relPos = [ +tokens[1], +tokens[2], +tokens[3] ];
				var latitude = Math.PI / 2 - Math.atan2(Math.sqrt(relPos[0] * relPos[0] + relPos[1] * relPos[1]), relPos[2]);
				var longitude = Math.atan2(relPos[1], relPos[0]);
				var coord = new WorldWind.Position(latitude * 180 / Math.PI, longitude * 180 / Math.PI, tokens[4] * 1000);
				coord.throttle  = +tokens[12];
				coord.downrange = tokens[6] * 1000;
				return (coord);
			});
			// TODO - nicer highlighting of throttle in the path
			var colors = points.map(function(point) {
				if (point.throttle > .5) {
					return stage.failure ? WorldWind.Color.FADEDORANGE : WorldWind.Color.ORANGE;
				} else {
					return WorldWind.Color[stage.color];
				}
			});

			kml.push(placemarkTemplate.replace("$name", stage.name)
				.replace("$color", formatColor(WorldWind.Color[stage.color]))
				.replace("$coordinates", points.map(function(p) {
					return p.longitude + "," + p.latitude + "," + p.altitude;
				}).join("\n")));

		    // Create the path.
		    var path = new WorldWind.Path(points, null);
		    path.altitudeMode = WorldWind.RELATIVE_TO_GROUND;
		    path.followTerrain = false;
		    path.extrude = false; // make it a curtain
		    path.useSurfaceShapeFor2D = true; // use a surface shape in 2D mode

		    // Create and assign the path's attributes.
		    var pathAttributes = new WorldWind.ShapeAttributes(null);
			pathAttributes.outlineWidth = 3;
		    pathAttributes.outlineColor = WorldWind.Color[stage.color];
		    pathAttributes.interiorColor = WorldWind.Color[stage.color];
		    pathAttributes.drawVerticals = path.extrude; // draw verticals only when extruding
		    path.attributes = pathAttributes;

        	var pinLibrary = "http://worldwindserver.net/webworldwind/images/white-dot.png";
            var placemarkAttributes = new WorldWind.PlacemarkAttributes(null);

			placemarkAttributes.imageScale = 0.1;
	        placemarkAttributes.labelAttributes.offset = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 1, WorldWind.OFFSET_FRACTION, 0.5);
    	    placemarkAttributes.labelAttributes.color = WorldWind.Color.WHITE;

	        // For each placemark image, create a placemark with a label.
            // Create the placemark and its label.
            var placemark = new WorldWind.Placemark(points[0], true, null);
            placemark.altitudeMode = WorldWind.RELATIVE_TO_GROUND;

            // Create the placemark attributes for this placemark. Note that the attributes differ only by their
            // image URL.
            placemarkAttributes = new WorldWind.PlacemarkAttributes(placemarkAttributes);
            placemarkAttributes.imageSource = pinLibrary;
            placemark.attributes = placemarkAttributes;

            // Add the placemark to the layer.
            pathsLayer.addRenderable(placemark);

			stageModel.push({
				start: parseInt(lines[0], 10),
				points: points,
				point: placemark
			});
			callback();

		    // Add the path to a layer and the layer to the World Window's layer list.
		    pathsLayer.addRenderable(path);
		    wwd.addLayer(pathsLayer);

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
			//stageModel[i].point.label.show = true;
			//stageModel[i].point.color = WorldWind.Color.WHITE;
			if (seconds < stageModel[i].start) { // before separation
				if (i > 0) {
					stageModel[i].point.position = stageModel[i - 1].point.position;
					//stageModel[i].point.color = stageModel[i - 1].point.point.color;
				}
				//stageModel[i].point.text.show = false;
			} else if (seconds > stageModel[i].start + stageModel[i].points.length) { // after video
				var pos = stageModel[i].points[stageModel[i].points.length - 1];
				stageModel[i].point.position = pos;
				stageModel[i].point.label = formatMeters("Altitude", pos.altitude) + "\n" +
										formatMeters("Downrange", pos.downrange);
				
			} else {
				var pos = stageModel[i].points[seconds - stageModel[i].start];
				stageModel[i].point.position = pos;
				stageModel[i].point.label = formatMeters("Altitude", pos.altitude) + "\n" +
										formatMeters("Downrange", pos.downrange);
				if (pos.throttle > .5) {
					//stageModel[i].point.color = WorldWind.Color.ORANGE;
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
// Create a World Window for the canvas.
var wwd = new WorldWind.WorldWindow("cesiumContainer");
wwd.addLayer(new WorldWind.BMNGOneImageLayer());

// Add some image layers to the World Window's globe.

        var starFieldLayer = new WorldWind.StarFieldLayer();
        var atmosphereLayer = new WorldWind.AtmosphereLayer();

        //IMPORTANT: add the starFieldLayer before the atmosphereLayer
        wwd.addLayer(starFieldLayer);
        wwd.addLayer(atmosphereLayer);

        var date = new Date();
        starFieldLayer.time = date;
        atmosphereLayer.time = date;
wwd.addLayer(new WorldWind.BingAerialLayer());

// Add a compass, a coordinates display and some view controls to the World Window.
wwd.addLayer(new WorldWind.CoordinatesDisplayLayer(wwd));

$("#f9missions").on("loadMission", "a", missionLoader(vehicles.F9));
$("#fhmissions").on("loadMission", "a", missionLoader(vehicles.FH));

// add play controls if we don't have a youtube video
$("#restart").on("click", function() { pseudoPlayer.setCurrentTime(0); });
$("#play").on("click",    function() { pseudoPlayer.setPlaying(true); });
$("#pause").on("click",   function() { pseudoPlayer.setPlaying(false); });

$(window).on("hashchange", function() {
	if (/^\#\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(window.location.hash)) {
		loadMission(window.location.hash.substring(1), vehicles.F9, false, null);
	} else {
		$(window.location.hash).trigger("loadMission");
	}
}).trigger("hashchange");

