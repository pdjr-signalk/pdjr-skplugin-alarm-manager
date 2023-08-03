/**
 * Copyright 2020 Paul Reeve <preeve@pdjr.eu>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const bacon = require("baconjs");
const Log = require("./lib/signalk-liblog/Log.js");
const Delta = require("./lib/signalk-libdelta/Delta.js");

const PLUGIN_ID = "alarm-manager";
const PLUGIN_NAME = "pdjr-skplugin-alarm-manager";
const PLUGIN_DESCRIPTION = "Issue notification and other outputs in response to Signal K alarm conditions.";
const PLUGIN_SCHEMA_ = {
  "type": "object",
  "properties": {
    "ignorepaths": {
      "type": "array",
      "description": "Paths that that should be ignored by the alarm manager",
      "title": "Ignore keys under these paths", 
      "items": { "type": "string" },
      "default": []
    },
    "outputs": {
      "description": "Switch paths that should be set when active alarms with the defined states are present",
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "path": { "type": "string" },
          "triggerstates": {
            "type": "array",
            "items": { "type": "string", "enum": [ "normal", "warn", "alert", "alarm", "emergency" ] }
          }
        }
      },
      "default": []
    }
  }
}
const PLUGIN_UISCHEMA = {};

const OPTIONS_IGNOREPATHS_DEFAULT = [ "design.", "electrical.", "environment.", "network.", "notifications.", "sensors." ];
const OPTIONS_OUTPUTS_DEFAULT = [];

const ALARM_STATES = [ "nominal", "normal", "alert", "warn", "alarm", "emergency" ];
const PLUGIN_DIGEST_KEY = "plugins." + PLUGIN_ID + ".digest";

module.exports = function (app) {
  var plugin = {};
  var unsubscribes = [];
  var notificationDigest = { "normal": [], "alert": [], "warn": [], "alarm": [], "emergency": [] };

  plugin.id = PLUGIN_ID;
  plugin.name = PLUGIN_NAME;
  plugin.description = PLUGIN_DESCRIPTION;
  plugin.schema = PLUGIN_SCHEMA;
  plugin.uiSchema = PLUGIN_UISCHEMA;
  
  plugin.start = function(options, restartPlugin) {
    var numberOfAvailablePaths = 0;

    app.on('serverevent', (e) => {
      if ((e.type) && (e.type == "SERVERSTATISTICS") && (e.data.numberOfAvailablePaths)) {
        if (numberOfAvailablePaths == 0) {
          numberOfAvailablePaths = e.data.numberOfAvailablePaths;
        } else {
          if (numberOfAvailablePaths != e.data.numberOfAvailablePaths) {
            log.N("restarting plugin");
            restartPlugin();
          }
        }
      }
    });

    options.ignorepaths = (options.ignorepaths || OPTIONS_IGNOREPATHS_DEFAULT);
    options.outputs = (options.outputs || OPTIONS_OUTPUTS_DEFAULT);

    var alarmPaths = getAvailableAlarmPaths(app, options.ignorepaths);
    log.N("monitoring %d alarm path%s", alarmPaths.length, (alarmPaths.length == 1)?"":"s");
    alarmPaths.forEach(path => {
      var meta = app.getSelfPath(path + ".meta");
      let zones = meta.zones.sort((a,b) => (ALARM_STATES.indexOf(a.state) - ALARM_STATES.indexOf(b.state)));
      zones.forEach(zone => { zone.method = (meta[zone.state + "Method"])?meta[zone.state + "Method"]:[]; });
      var stream = app.streambundle.getSelfStream(path);
      unsubscribes.push(stream.skipDuplicates().onValue(v => {
        var updated = false;
        var notification = getAlarmNotification(v, zones);
        if (notification) { // Value is alarming...
          if (!notificationDigest.includes(path)) {
            log.N("issuing notification on '%s'", path);
            notificationDigest[notification.state].push(path);
            (new Delta(app, plugin.id)).addValue("notifications." + path, notification).commit().clear();
            updated = true;
          }
        } else {
          if (notificationDigest.includes(path)) {
            log.N("cancelling notification on '%s'", path);
            Object.keys(notificationDigest).forEach(key => delete notificationDigest[key][path]);
            (new Delta(app, plugin.id)).addValue("notifications." + path, null).commit().clear();
            updated = true;
          }
        }
        if (updated) {
          (new Delta(app, plugin.id)).addValue(PLUGIN_DIGEST_KEY, notificationDigest).commit().clear();
          if (options.outputs) {
            var outputPath = options.outputs.reduce((a,o) => { return((o.triggerstates.includes(notification.state))?o.path:a); }, null);
            if (outputPath) app.putSelfPath(outputPath + ".state", 1);
          }
        }
      }));
    });
  }

  plugin.stop = function() {
	unsubscribes.forEach(f => f());
    var unsubscribes = [];
  }

  /********************************************************************
   * Returns a well formed notification object or null dependent upon
   * whether or not <value> is captured by a rule in the <zones> array.
   */

  function getAlarmNotification(value, zones) {
    var notificationValue = null;
    zones.forEach(zone => {
      if (((!zone.lower) || (value >= zone.lower)) && ((!zone.upper) || (value <= zone.upper))) {
        var now = Date.now();
        notificationValue = { "state": zone.state, "method": zone.method, "message": zone.message, "id": now };
      }
    });
    return(notificationValue);
  }

  /********************************************************************
   * Returns a list of terminal paths recovered from <app> which have
   * meta.zones properties and are as a consequence able to support
   * alarm operation. The list of all available paths is initially
   * filtered to remove those paths with prefixes in the <ignore>
   * array.
   */

  function getAvailableAlarmPaths(app, ignore=[]) {
    var retval = app.streambundle.getAvailablePaths()
      .filter(p => !ignore.reduce((a,ip) => { return(p.startsWith(ip)?true:a); }, false))
      .filter(p => {
        var meta = app.getSelfPath(p + ".meta");
        return((meta) && (meta.zones) && (meta.zones.length > 0));
      });
    return(retval);
  }
   
  return(plugin);
}
