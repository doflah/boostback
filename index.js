import React from "react";
import ReactDOM from "react-dom";
import Boostback from "./Boostback.js";

var vehicles = {
	"F9": [{"name":"UpperStage", "color":"CYAN"}, {"name":"Booster", "color":"RED"},
		{failure: true, "name":"UpperStage_planned", "color":"FADEDCYAN"}, {failure: true, "name":"Booster_planned", "color":"FADEDRED"}],
	"FH": [{"name":"UpperStage", "color":"CYAN"}, {"name":"Core", "color":"GREEN"}, {"name":"LeftBooster", "color":"RED"}, {"name":"RightBooster", "color":"RED"}]
};

var schedule = [
	{id: "CRS-5", name: "CRS-5", video: "p7x-SumbynI", start: 958, year: 2015},
	{id: "DSCOVR", name: "DSCOVR", video: "OvHJSIKP0Hg", start: 960, year: 2015},
	{id: "CRS-7", name: "CRS-7", year: 2015},
	{id: "OrbComm_OG2_Launch_2", name: "OrbComm OG2 (Launch 2)", video: "O5bTbVbe4e4", start: 1380, year: 2015},
	{id: "Jason-3", name: "Jason-3", video: "vkz_lclGXNg", start: 1310, year: 2016},
	{id: "SES-9", name: "SES-9", year: 2016},
	{id: "FH_Demo", name: "Falcon Heavy Demo", vehicle: "FH", year: 2018},
];

schedule.forEach((mission) => mission.vehicle = vehicles[mission.vehicle || "F9"]);

ReactDOM.render(
	<Boostback vehicles={vehicles} schedule={schedule} />,
	document.getElementById("boostback")
);
