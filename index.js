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

const Log = require("signalk-liblog/Log.js");
const Delta = require("signalk-libdelta/Delta.js");
const Notification = require("signalk-libnotification/Notification.js");
const MyApp = require('signalk-libapp/App.js');

const ALARM_STATES = [ "nominal", "normal", "alert", "warn", "alarm", "emergency" ];
const PATH_CHECK_INTERVAL = 20; // seconds

const PLUGIN_ID = "alarm-manager";
const PLUGIN_NAME = "pdjr-skplugin-alarm-manager";
const PLUGIN_DESCRIPTION = "Issue notification and other outputs in response to Signal K alarm conditions.";
const PLUGIN_SCHEMA = {
  "type": "object",
  "properties": {
    "ignorePaths": {
      "title": "Ignore paths",
      "description": "Paths or path prefixes that should be ignored by the alarm manager",
      "type": "array",
      "items": { "type": "string" },
      "default": [ "design.", "electrical.", "environment.", "network.", "notifications.", "plugins.", "sensors." ]
    },
    "digestPath": {
      "title": "Digest path",
      "description": "Signal K key that will hold the alarm notification digest",
      "type": "string",
      "default": "plugins.alarm-manager.digest"
    },
    "keyChangeNotificationPath": {
      "title": "Key change notification path",
      "description": "Issue notification here when key collection changes",
      "type": "string",
      "default": "notifications.plugins.alarm-manager.keyChange"
    },
    "outputs": {
      "title": "Output channels",
      "description": "Output channels that should be set when active alarms with the defined states are present",
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "title": "Output channel name",
            "type": "string"
          },
          "path": {
            "title": "Signal K key that will report the output channel state",
            "description": "This can be a switch path or a notification path",
            "type": "string"
          },
          "triggerStates": {
            "title": "Trigger states",
            "description": "Alarm states which will modulate this output",
            "type": "array",
            "items": {
              "type": "string",
              "enum": ALARM_STATES
            },
            "uniqueItems": true
          },
          "suppressionPath": {
            "title": "Suppression path",
            "description": "Signal K path which can be modulated to suppress output on this channel",
            "type": "string"
          }
        },
        "required" : [ "name", "path", "triggerStates" ],
        "default": { triggerStates: ALARM_STATES }
      }
    }
  }
};
const PLUGIN_UISCHEMA = {};

module.exports = function (app) {
  var plugin = {};
  var unsubscribes = [];
  var resistantUnsubscribes = [];
  var alarmPaths = [];
  var notificationDigest = { };
  var intervalId = null;

  plugin.id = PLUGIN_ID;
  plugin.name = PLUGIN_NAME;
  plugin.description = PLUGIN_DESCRIPTION;
  plugin.schema = PLUGIN_SCHEMA;
  plugin.uiSchema = PLUGIN_UISCHEMA;
  plugin.App = new MyApp(app);

  const log = new Log(plugin.id, { ncallback: app.setPluginStatus, ecallback: app.setPluginError });
  
  plugin.start = function(options, restartPlugin) {

    // Expand options to include any schema default and save
    // result to plugin scope.
    plugin.options = {
      ignorePaths: options.ignorePaths || plugin.schema.properties.ignorePaths.default,
      digestPath: options.digestPath || plugin.schema.properties.digestPath.default,
      keyChangeNotificationPath: options.keyChangeNotificationPath || plugin.schema.properties.keyChangeNotificationPath.default,
      outputs: (options.outputs || []).reduce((a, output) => {
        try {
          var validOutput = { ...plugin.schema.properties.outputs.items.default, ...output };
          if (!validOutput.name) throw new Error("missing 'name' property");
          if (!validOutput.path) throw new Error("missing 'path' property");
          if (!validOutput.triggerStates.reduce((a,v) => (a && plugin.schema.properties.outputs.items.properties.triggerStates.items.enum.includes(v)), true)) throw new Error("invalid 'triggerStates' property");
          a.push(validOutput);
        } catch(e) { log.W(`dropping output channel '(${e.message})`); }
        return(a);
      }, [])
    }

    app.debug(`using configuration: ${JSON.stringify(plugin.options, null, 2)}`);

    // Subscribe to any suppression paths configured for the output
    // channels and persist these across the lifetime of the plugin.
    if (plugin.options.outputs) {
      plugin.options.outputs.forEach(output => {
        var stream = app.streambundle.getSelfStream(output.suppressionPath);
        resistantUnsubscribes.push(stream.skipDuplicates().onValue(v => {
          if (v == 1) {
            app.debug(`suppressing output channel '${output.name}'`);
            Object.keys(notificationDigest).forEach(key => {
              if (!notificationDigest[key].actions.includes(output.name)) notificationDigest[key].actions.push(output.name);
            })     
          }
        }));
      });
    }
    
    startAlarmMonitoringMaybe = startAlarmMonitoringMaybe.bind(this);
    
    // Repeatedly check the available key set for those that are
    // configured for alarm use.
    intervalId = setInterval(() => {
      startAlarmMonitoringMaybe(notificationDigest, unsubscribes);
    }, (PATH_CHECK_INTERVAL * 1000));
  }

  plugin.stop = function() {
    if (intervalId) clearInterval(intervalId);
	  unsubscribes.forEach(f => f());
    unsubscribes = [];
	  resistantUnsubscribes.forEach(f => f());
    resistantUnsubscribes = [];
  }

  plugin.registerWithRouter = function(router) {
    router.get('/keys', handleRoutes);
    router.get('/digest/', handleRoutes);
    router.get('/outputs/', handleRoutes);
    router.get('/output/:name', handleRoutes);
    router.patch('/suppress/:name', handleRoutes);
  }

  plugin.getOpenApi = function() {
    require("./resources/openApi.json");
  }

  /**
   * Start or re-start the alarm monitor function by identifying all
   * data paths in the current data store which support alarm operation
   * and compares this with the collection currently in use. If there
   * is a difference, then unsubscribe the current collection, notify
   * a key change and call startAlarmMonitoring() with the new set of
   * data paths.
   * 
   * @param {*} digest - the alarm digest.
   * @param {*} unsubscribes - stream unsubscribe function array.
   */
  function startAlarmMonitoringMaybe(digest, unsubscribes) {
    var availableAlarmPaths = getAlarmPaths(app.streambundle.getAvailablePaths(), plugin.options.ignorePaths);
    if (!compareAlarmPaths(alarmPaths, availableAlarmPaths)) {
      log.N(`monitoring ${availableAlarmPaths.length} alarm path${(availableAlarmPaths.length == 1)?'':'s'}`);
      alarmPaths = availableAlarmPaths;
      if (unsubscribes.length > 0) { unsubscribes.forEach(f => f()); unsubscribes = []; }
      if (plugin.options.keyChangeNotificationPath) plugin.App.notify(plugin.options.keyChangeNotificationPath, { state: "alert", method: [], message: "Monitored key collection has changed" }, plugin.id);
      startAlarmMonitoring(alarmPaths, digest, unsubscribes);
    }
  }

  /**
   * Start monitoring the keys specified by alarmPaths by subscribing
   * for updates (adding the unsubscribe function to unsubscribes).
   * Detected alarm conditions are notified and digest is updated to
   * reflect the system's current alarm state.
   *   
   * @param {*} alarmPaths - array of keys to monitor.
   * @param {*} digest - digest object to be updated.
   * @param {*} unsubscribes - array of unsubscribes functions.
   */
  function startAlarmMonitoring(alarmPaths, digest, unsubscribes) {
    alarmPaths.forEach(path => {
      const zones = (app.getSelfPath(`${path}.meta`)).zones.sort((a,b) => (ALARM_STATES.indexOf(a.state) - ALARM_STATES.indexOf(b.state)));
      unsubscribes.push(app.streambundle.getSelfStream(path).skipDuplicates().map((v) => getZoneContainingValue(zones, v)).skipDuplicates((ov,nv) => (((ov)?ov.state:null) == ((nv)?nv.state:null))).onValue(activeZone => {
        var updated = false;
        if (activeZone) {
          if ((!digest[path]) || (digest[path].state != activeZone.state)) {
            app.debug(`issuing '${activeZone.state}' notification on '${path}'`);
            const notification = (new Notification(app)).makeNotification(path, { state: activeZone.state, method: activeZone.method, message: activeZone.message });
            digest[path] = notification;
            plugin.App.notify(path, notification, plugin.id);
            updated = true;
          }
        } else {
          app.debug(`cancelling notification on '${path}'`);
          if (digest[path]) {
            delete digest[path];
            plugin.App.notify(path, null, plugin.id);
            updated = true;
          }
        }
        if (updated === true) {
          (new Delta(app, plugin.id)).addValue(plugin.options.digestPath, digest).commit().clear();
          (plugin.options.outputs || []).forEach(output => {
            var activeDigestStates = Object.keys(digest)
            .filter(key => !digest[key].actions.includes(output.name)) // discard suppressed notifications
            .map(key => (digest[key].state));             // isolate the notification's state
            updateOutput(output, (output.triggerStates.reduce((a,state) => (activeDigestStates.includes(state) || a), false))?1:0, path);
          });
        }
      }));
    });
  }

  function updateOutput(output, state, path) {
    var matches;
    if ((matches = output.path.match(/^electrical\.switches\.(.*)\.state$/)) && (matches == 2)) {
      if (output.lastUpdateState != state) {
        app.debug(`updating switch output '${output.name}' to state ${state}`);
        app.putSelfPath(output.path, state);
        output.lastUpdateState = state;
      }
    } else if ((matches = output.path.match(/^notifications\.(.*)\:(.*)\:(.*)$/)) && (matches.length == 4)) {
      var notificationState = (state)?matches[2]:matched[3];
      if (output.lastUpdateState != state) {
        plugin.App.notify(`notifications.${matches[1]}`, { state: notificationState, method: [], message: path }, plugin.id);
        output.lastUpdateState = state;
      }
    } else if ((matches = output.path.match(/^notifications\.(.*)\:(.*)$/)) && (matches.length == 3)) {
      notificationState = (state)?matches[2]:null;
      if (output.lastUpdateState != state) {
        plugin.App.notify(`notifications.${matches[1]}`, { state: notificationState, method: [], message: path }, plugin.id);
        output.lastUpdateState = state;
      }
    } else if ((matches = output.path.match(/^notifications\.(.*)$/)) && (matches.length == 2)) {
      notificationState = (state)?'normal':null;
      if (output.lastUpdateState != state) {
        plugin.App.notify(`notifications.${matches[1]}`, { state: notificationState, method: [], message: path }, plugin.id);
        output.lastUpdateState = state;
      }
    } else {
      throw new Error(output.path);
    }
  }  

  /********************************************************************
   * Returns the first entry in the zones array that contains value,
   * or null if value is not contained in any zone.
   * 
   * @param {*} zones - an array of Signal K alarm zones.
   * @param {*} value - value to be tested for containment.
   * @returns - an alarm zone or null.
   */
  function getZoneContainingValue(zones, value) {
    var containingZone = null;
    zones.forEach(zone => {
      if (((!zone.lower) || (value >= zone.lower)) && ((!zone.upper) || (value <= zone.upper))) {
        if (!containingZone) {
          containingZone = zone;
        } else {
          if ((zone.lower) && (zone.lower > containingZone.lower)) containingZone = zone;
          if ((zone.upper) && (zone.upper < containingZone.upper)) containingZone = zone;
        }
      }
    });
    return(containingZone);
  }

  /********************************************************************
   * Filters availablePaths excluding any that match entries in
   * ignorePaths and of these, any incapable of supporting alarm
   * function because their metadata does not define any alarm zones.
   * 
   * @param {*} availablePaths - collection of paths to be filtered.
   * @param {*} ignorePaths - prefixes of paths to be ignored.
   * @returns - list of paths configured to support alarm function.
   */
  function getAlarmPaths(availablePaths, ignorePaths) {
    var retval = availablePaths
      .filter(p => (!(ignorePaths.reduce((a,ip) => { return(p.startsWith(ip)?true:a); }, false))))
      .filter(p => { var meta = app.getSelfPath(`${p}.meta`); return((meta) && (meta.zones) && (meta.zones.length > 0)); }); 
    return(retval.sort());
  }

  /********************************************************************
   * Deep compare two string arrays for equality.
   * 
   * @param {*} a - first array.
   * @param {*} b - second array.
   * @returns - boolean TRUE if equal otherwise false.
   */
  function compareAlarmPaths(a, b) {
    var retval = false;
    if (a.length !== b.length) return(false);
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return(false);
    return(true);
  }

  /********************************************************************
   * EXPRESS ROUTE HANDLING
   */

  function handleRoutes(req, res) {
    app.debug(`processing ${req.method} request on '${req.path}'`);
    try {
      switch (req.path.slice(0, (req.path.indexOf('/', 1) == -1)?undefined:req.path.indexOf('/', 1))) {
        case '/keys':
          expressSend(res, 200, alarmPaths, req.path);
          break;
        case '/digest':
          expressSend(res, 200, notificationDigest, req.path);
          break;
        case '/outputs':
          expressSend(res, 200, plugin.options.outputs.reduce((a,v) => { a[v.name] = v.lastUpdateState; return(a); }, {}), req.path);
          break;
        case '/output':
          var output = plugin.options.outputs.reduce((a,o) => ((o.name == req.params.name)?o:a), null);
          if (output) {
            expressSend(res, 200, new Number(output.lastUpdateState), req.path);
          } else {
            expressSend(res, 404, "404: invalid request", req.path);
          }
          break;
        case '/suppress':
          if (plugin.options.outputs.map(output => output.name).includes(req.params.name)) {
            Object.keys(notificationDigest).forEach(key => {
              if (!notificationDigest[key].suppressedOutputs.includes(req.params.name)) notificationDigest[key].suppressedOutputs.push(req.params.name);
            });
            expressSend(res, 200, null, req.path);
          } else {
            expressSend(res, 404, "404: invalid request", req.path);
          }
          break;
      }
    } catch(e) {
      app.debug(e.message);
      expressSend(res, ((/^\d+$/.test(e.message))?parseInt(e.message):500), null, req.path);
    }

    function expressSend(res, code, body = null, debugPrefix = null) {
      const FETCH_RESPONSES = { 200: null, 201: null, 400: "bad request", 403: "forbidden", 404: "not found", 503: "service unavailable (try again later)", 500: "internal server error" };
      res.status(code).send((body)?body:((FETCH_RESPONSES[code])?FETCH_RESPONSES[code]:null));
      if (debugPrefix) app.debug(`${debugPrefix}: ${code} ${(body)?JSON.stringify(body):((FETCH_RESPONSES[code])?FETCH_RESPONSES[code]:null)}`);
      return(false);
    }
  }

  return(plugin);
}
