import React, { Component} from "react";
import '@nasaworldwind/worldwind';

var KML = {
	templateStart: '<?xml version="1.0" encoding="UTF-8"?>\
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
	</Style>',
	templateEnd: '	</Document></kml>',
	hazardTemplate: '<Placemark> \
	<name>Hazard zone</name>\
	<Polygon> <outerBoundaryIs>  <LinearRing>\
		<coordinates>$coordinates</coordinates>\
	</LinearRing> </outerBoundaryIs> </Polygon>\
	<styleUrl>#hazardStyle</styleUrl>\
</Placemark>',
	placemarkTemplate: '<Placemark>\
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
</Placemark>'
};

class Boostback extends React.Component {
	constructor(props) {
		super(props);
		this.selectMission = this.selectMission.bind(this);
		this.state = { };
	}
	render() {
		return <React.Fragment>
				<Navigation selectMission={this.selectMission} schedule={this.props.schedule} />
				<Globe mission={this.state.mission} />
				<Player />
				<div id="aboutDlg" className="modal" tabIndex="-1" role="dialog">
		<div className="modal-dialog">
			<div className="modal-content">
				<div className="modal-header">
					<button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
					<h4 className="modal-title">About <i>Boostback</i></h4>
				</div>
				<div className="modal-body">
					<p>This webapp is used to plot data files from <a href="http://flightclub.io">Flight Club</a> on a 3d map.</p>
					<p>Select a mission from a navigation dropdown to draw it on the map.  Booster trajectory is red and upper stage
						trajectory is cyan.  FH core trajectory is green.  Burns along each trajectory are colored in orange. If a
						mission has a video associated with it, a point along the path will follow along.</p>
					<p>The developer of this tool is not associated with SpaceX.</p>
				</div>
			</div>
		</div>
	</div>
			</React.Fragment>;
	}
	selectMission(mission) {
		this.setState({"mission": mission});
	}
	updateTime(time) {

	}
}

class Navigation extends React.Component {
	constructor(props) {
		super(props);
		this.selectMission = props.selectMission;
		this.missions =	props.schedule.map(function(year, i) {
			let missionList = year.missions.map(function(mission, i){
				return <li key={mission.name}><a onClick={() => props.selectMission(mission)}>{mission.name} <span className="glyphicon glyphicon-facetime-video"></span></a></li>;
			});
			missionList.splice(0, 0, <li key={year.year} className="dropdown-header">{year.year}</li>);
			return missionList;
		});
	}
	render() {
		return 	<nav className="navbar navbar-default" style={{zIndex: '1'}}>
		<div className="container">
			<div className="navbar-header">
				<button type="button" className="navbar-toggle collapsed" data-toggle="collapse" data-target="#bs-example-navbar-collapse-1" aria-expanded="false">
					<span className="sr-only">Toggle navigation</span>
					<span className="icon-bar"></span>
					<span className="icon-bar"></span>
					<span className="icon-bar"></span>
				</button>
				<a className="navbar-brand" href="#">Boostback</a>
			</div>

			<div className="collapse navbar-collapse" id="bs-example-navbar-collapse-1">
				<ul className="nav navbar-nav navbar-right">
					<li>
						<a>Select a vehicle and mission:</a>
					</li>
					<li className="dropdown">
						<a href="#" className="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true" aria-expanded="false">Falcon 9 <span className="caret"></span></a>
						<ul className="dropdown-menu" id="f9missions">
							{this.missions}
						</ul>
					</li>
					<li className="dropdown">
						<a href="#" className="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true" aria-expanded="false">Falcon Heavy <span className="caret"></span></a>
						<ul className="dropdown-menu" id="fhmissions">
							<li><a href="#Falcon_Heavy" id="Falcon_Heavy">RTLS <span className="glyphicon glyphicon-facetime-video"></span></a></li>
						</ul>
					</li>
					<li>
						<a id="downloadKML">Download KML</a>
					</li>
					<li>
						<a href="#" data-toggle="modal" data-target="#aboutDlg">About</a>
					</li>
				</ul>
			</div>
		</div>
	</nav>;
	}
}

class Globe extends React.Component {
	constructor(props) {
		super(props);
		this.canvasId = "worldWindow";
	}

	render() {
		return <canvas id={this.canvasId}></canvas>;
	}

	componentDidMount() {
		WorldWind.Color.FADEDCYAN   = new WorldWind.Color(0, 1, 1, .5);
		WorldWind.Color.FADEDRED    = new WorldWind.Color(1, 0, 0, .5);
		WorldWind.Color.ORANGE = new WorldWind.Color(1,.5, 0);
		WorldWind.Color.FADEDORANGE = new WorldWind.Color(1,.5, 0, .5);

		let wwd = new WorldWind.WorldWindow(this.canvasId);
		this.wwd = wwd;
		wwd.addLayer(new WorldWind.BMNGOneImageLayer());
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

		this.pathsLayer = new WorldWind.RenderableLayer();
		this.pathsLayer.displayName = "Paths";
		wwd.addLayer(this.pathsLayer);
	}

	componentDidUpdate(prevProps, prevState) {
		//if (this.props.mission != prevProps.mission) return;
		var pathsLayer = this.pathsLayer;
		pathsLayer.removeAllRenderables();
		var wwd = this.wwd;
		var missionName = this.props.mission.name;
		var stages = this.props.mission.vehicle;
		var append = false;
		var video = null;
		var uuid = /^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(missionName);
		//document.title = uuid ? "Boostback" : ("Boostback | " + missionName);
		var kml = [];

		var stageModel = [];
		var count = 0;
		var callback = function() {
			count += 1;
			if (count === stages.length) {
				// point camera at launch pad
				stageModel.sort(function(a, b) { return a.start > b.start; });
				// TODO: point camera at launch site
	
				// generate KML file blob
				kml.push(KML.templateEnd);
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

				kml.push(KML.placemarkTemplate.replace("$name", stage.name)
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
	}
}

class Player extends React.Component {
	render() {
		return 	<aside id="launchPlayer">
		<div id="instructions" className="sidebar">
		Select a mission from the navigation menu.  Missions with a <span className="glyphicon glyphicon-facetime-video"></span>
		icon have video associated with them.
		</div>
		<div id="pseudoPlayer" className="sidebar">
			There is no video for this mission yet.  Use the play/pause/restart buttons to play the mission.<br />
			<div className="progress"><div className="progress-bar"></div></div>
			<div className="btn-group">
				<button onClick={this.restart} type="button" className="btn btn-default"><span className="glyphicon glyphicon-repeat"></span></button>
				<button onClick={this.play} type="button" className="btn btn-default"><span className="glyphicon glyphicon-play"></span></button>
				<button onClick={this.pause} type="button" className="btn btn-default"><span className="glyphicon glyphicon-pause"></span></button>
			</div>
		</div>
	</aside>;
	}

	restart() {
		this.setCurrentTime(0);
	}

	play() {
		setPlaying(true);
	}

	pause() {
		setPlaying(false);
	}

	setPlaying(status) {

	}
}

function blanks(a){return a.charAt(0) != '#' && a.charAt(0) != '-' && a.charAt(1) != '-' && a !== "";};

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
	kml.push(KML.hazardTemplate.replace("$coordinates", coords.map(function(coord) { return coord[0] + ","+ coord[1] + ",0"; }).join("\n")));
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

export default Boostback;
