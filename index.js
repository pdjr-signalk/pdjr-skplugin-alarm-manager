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

const Log = require("./lib/signalk-liblog/Log.js");
const Delta = require("./lib/signalk-libdelta/Delta.js");

const PLUGIN_ID = "alarm-manager";
const PLUGIN_NAME = "pdjr-skplugin-alarm-manager";
const PLUGIN_DESCRIPTION = "Issue notification and other outputs in response to Signal K alarm conditions.";
const PLUGIN_SCHEMA = {
  "type": "object",
  "properties": {
    "digestpath": {
      "type": "string",
      "description": "Where to put the alarm notification digest",
      "default": "plugins.alarm-manager.digest"
    },
    "ignorepaths": {
      "type": "array",
      "description": "Paths that that should be ignored by the alarm manager",
      "title": "Ignore keys under these paths", 
      "items": { "type": "string" },
      "default": [ "design.", "electrical.", "environment.", "network.", "notifications.", "plugins.", "sensors." ]
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
          },
          "suppressionPath": { "type": "string" }
        },
        "required" : [ "path", "triggerstates" ]
      }
    },
    "defaultMethods" : {
      "type": "object",
      "properties": {
        "alertMethod" : {
          "type" : "array",
          "items": {
            "type": "string"
          }
        },
        "warnMethod" : {
          "type" : "array",
          "items": {
            "type": "string"
          }
        },
        "alarmMethod" : {
          "type" : "array",
          "items": {
            "type": "string"
          }
        },
        "emergencyMethod" : {
          "type" : "array",
          "items": {
            "type": "string"
          }
        }
      },
      "default": {
        "alertMethod": [ "visual" ],
        "warnMethod": [ "visual" ],
        "alarmMethod": [ "sound", "visual" ],
        "emergencyMethod": [ "sound", "visual" ]
      }
    }
  }
}
const PLUGIN_UISCHEMA = {};

const ALARM_STATES = [ "nominal", "normal", "alert", "warn", "alarm", "emergency" ];

module.exports = function (app) {
  var plugin = {};
  var unsubscribes = [];
  var resistantUnsubscribes = [];
  var notificationDigest = { };

  plugin.id = PLUGIN_ID;
  plugin.name = PLUGIN_NAME;
  plugin.description = PLUGIN_DESCRIPTION;
  plugin.schema = PLUGIN_SCHEMA;
  plugin.uiSchema = PLUGIN_UISCHEMA;

  const log = new Log(plugin.id);
  
  plugin.start = function(options, restartPlugin) {
    var numberOfAvailablePaths = 0;
    var numberOfAvailableAlarmPaths = 0;

    var createConfiguration = (Object.keys(options).length == 0);

    options.digestpath = (options.digestpath || plugin.schema.properties.digestpath.default);
    options.ignorepaths = (options.ignorepaths || plugin.schema.properties.ignorepaths.default);
    options.outputs = (options.outputs || plugin.schema.properties.outputs.default);
    options.defaultMethods = (options.defaultMethods || plugin.schema.properties.defaultMethods.default );
    
    if (createConfiguration) app.savePluginOptions(options, () => { app.debug("saved plugin options") });

    if (options.outputs) {
      var id = 0;
      options.outputs.forEach(output => {
        output.id = (++id);
        var stream = app.streambundle.getSelfStream(output.suppressionPath);
        resistantUnsubscribes.push(stream.skipDuplicates().onValue(v => {
          if (v == 1) {
            Object.keys(notificationDigest).forEach(key => {
              if (!notificationDigest[key].suppressedOutputs.includes(output.id)) notificationDigest[key].suppressedOutputs.push(output.id);
            })     
          }
        }));
      });
    }

    app.on('serverevent', (e) => {
      if ((e.type) && (e.type == "SERVERSTATISTICS") && (e.data.numberOfAvailablePaths)) {
        if (e.data.numberOfAvailablePaths != numberOfAvailablePaths) {
          var availableAlarmPaths = getAvailableAlarmPaths(app, options.defaultMethods, options.ignorepaths);
          if (availableAlarmPaths.length != numberOfAvailableAlarmPaths) {
            numberOfAvailableAlarmPaths = availableAlarmPaths.length;
            if (unsubscribes) { unsubscribes.forEach(f => f()); unsubscribes = []; }
            startAlarmMonitoring(availableAlarmPaths);
          }
        }
      }
    });

    function startAlarmMonitoring(availableAlarmPaths) {
      log.N("monitoring %d alarm path%s", availableAlarmPaths.length, (availableAlarmPaths.length == 1)?"":"s");
      availableAlarmPaths.forEach(path => {
        var meta = app.getSelfPath(path + ".meta");
        let zones = meta.zones.sort((a,b) => (ALARM_STATES.indexOf(a.state) - ALARM_STATES.indexOf(b.state)));
        zones.forEach(zone => { zone.method = (meta[zone.state + "Method"])?meta[zone.state + "Method"]:[]; });
        var stream = app.streambundle.getSelfStream(path);
        unsubscribes.push(stream.skipDuplicates().onValue(v => {
          var updated = false;
          var notification = getAlarmNotification(v, zones);
          if (notification) { // Value is alarming...
            if ((!notificationDigest[path]) || (notificationDigest[path].notification.state != notification.state)) {
              app.debug("issuing notification on '%s'", path);
              notificationDigest[path] = { "notification": notification, "suppressedOutputs": [] };
              (new Delta(app, plugin.id)).addValue("notifications." + path, notification).commit().clear();
              updated = true;
            }
          } else {
            if (notificationDigest[path]) {
              app.debug("cancelling notification on '%s'", path);
              delete notificationDigest[path];
              (new Delta(app, plugin.id)).addValue("notifications." + path, null).commit().clear();
              updated = true;
            }
          }
          if (updated) {
            (new Delta(app, plugin.id)).addValue(options.digestpath, notificationDigest).commit().clear();
            if (options.outputs) {
              options.outputs.forEach(output => {
                var currentDigestStates = Object.keys(notificationDigest)
                .filter(key => !notificationDigest[key].suppressedOutputs.includes(output.id))
                .map(key => notificationDigest[key].notification.state);
                updateOutput(output, (output.triggerstates.filter(state => currentDigestStates.includes(state)).length > 0)?1:0);
              });
            }
          }
        }));
      });
    }

    function updateOutput(output, state) {
      var matches;
      if ((matches = output.path.match(/^switches\.(.*)\.state$/)) && (matches == 2)) {
        if (output.lastUpdateState != state) {
          app.putSelfPath(path, state);
          output.lastUpdateState = state;
        }
      } else if ((matches = output.path.match(/^notifications\.(.*)\:(.*)\:(.*)$/)) && (matches.length == 4)) {
        state = (state)?matches[2]:matched[3];
        if (output.lastUpdateState != state) {
          (new Delta(app, plugin.id)).addValue("notifications." + matches[1], { 'message': 'Alarm manager output', 'state': state, 'method': [] }).commit().clear();
          output.lastUpdateState = state;
        }
      } else if ((matches = output.path.match(/^notifications\.(.*)\:(.*)$/)) && (matches.length == 3)) {
        state = (state)?matches[2]:null;
        if (output.lastUpdateState != state) {
          (new Delta(app, plugin.id)).addValue("notifications." + matches[1], (state)?{ 'message': 'Alarm manager output', 'state': state, 'method': [] }:null).commit().clear();
          output.lastUpdateState = state;
        }
      } else if ((matches = output.path.match(/^notifications\.(.*)$/)) && (matches.length == 2)) {
        state = (state)?'normal':null;
        if (output.lastUpdateState != state) {
          (new Delta(app, plugin.id)).addValue("notifications." + matches[1], (state)?{ 'message': 'Alarm manager output', 'state': state, 'method': [] }:null).commit().clear();
          output.lastUpdateState = state;
        }
      } else {
        throw new Error(output.path);
      }
    }  

  }

  plugin.stop = function() {
	  unsubscribes.forEach(f => f());
    unsubscribes = [];
	  resistantUnsubscribes.forEach(f => f());
    resistantUnsubscribes = [];
  }

  /********************************************************************
   * Returns a well formed notification object or null dependent upon
   * whether or not <value> is captured by a rule in the <zones> array.
   */

  function getAlarmNotification(value, zones) {
    var notificationValue = null;
    var selectedZone = null;
    zones.forEach(zone => {
      if (((!zone.lower) || (value >= zone.lower)) && ((!zone.upper) || (value <= zone.upper))) {
        if (!selectedZone) {
          selectedZone = zone;
        } else {
          if ((zone.lower) && (zone.lower > selectedZone.lower)) selectedZone = zone;
          if ((zone.upper) && (zone.upper < selectedZone.upper)) selectedZone = zone;
        }
      }
    });
    if (selectedZone) {
      var now = Date.now();
      notificationValue = { "state": selectedZone.state, "method": selectedZone.method, "message": selectedZone.message, "id": now };
    }
    return(notificationValue);
  }

  /********************************************************************
   * Returns a list of terminal paths recovered from <app> which have
   * meta.zones properties and are as a consequence able to support
   * alarm operation. The list of all available paths is initially
   * filtered to remove those paths with prefixes in the <ignore>
   * array.
   */

  function getAvailableAlarmPaths(app, defaultMethods, ignore=[]) {
    var retval = app.streambundle.getAvailablePaths()
      .filter(p => (!(ignore.reduce((a,ip) => { return(p.startsWith(ip)?true:a); }, false))))
      .filter(p => {
        var meta = app.getSelfPath(p + ".meta");
        if ((meta) && (meta.zones) && (meta.zones.length > 0)) {
          meta.alertMethod = (meta.alertMethod || defaultMethods.alertMethod);
          meta.warnMethod = (meta.warnMethod || defaultMethods.warnMethod);
          meta.alarmMethod = (meta.alarmMethod || defaultMethods.alarmMethod);
          meta.emergencyMethod = (meta.emergencyMethod || defaultMethods.emergencyMethod);
          return(true);
        } else {
          return(false);
        }
      });
    return(retval);
  }
   
  return(plugin);
}
