import React from "react";
import ReactDOM from "react-dom";
import Boostback from "./Boostback.js";

var vehicles = {
	"F9": [{"name":"UpperStage", "color":"CYAN"}, {"name":"Booster", "color":"RED"},
		{failure: true, "name":"UpperStage_planned", "color":"FADEDCYAN"}, {failure: true, "name":"Booster_planned", "color":"FADEDRED"}],
	"FH": [{"name":"UpperStage", "color":"CYAN"}, {"name":"Core", "color":"LIGHTGREEN"}, {"name":"Booster", "color":"RED"}]
};

var schedule = [
	{
		year: 2015,
		missions: [
			{name: "CRS-5", video: "p7x-SumbynI", start: 958},
			{name: "DSCOVR", video: "OvHJSIKP0Hg", start: 960},
			{name: "CRS-7"},
			{name: "OrbComm_OG2_Launch_2", video: "O5bTbVbe4e4", start: 1380},
		]
	},
	{
		year: 2016,
		missions: [
			{name: "Jason-3", video: "vkz_lclGXNg", start: 1310},
			{name: "SES-9"},
		]
	}
];

schedule.forEach((year) => year.missions.forEach((mission) => mission.vehicle = vehicles["F9"]));

ReactDOM.render(
  <Boostback vehicles={vehicles} schedule={schedule} />,
  document.getElementById("boostback")
);
