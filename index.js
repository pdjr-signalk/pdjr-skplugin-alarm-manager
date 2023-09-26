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

const _ = require("lodash");
const crypto = require("crypto");
const webpush = require("web-push");
const Log = require("./lib/signalk-liblog/Log.js");
const Delta = require("./lib/signalk-libdelta/Delta.js");

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
              "enum": [ "normal", "warn", "alert", "alarm", "emergency" ]
            },
            "uniqueItems": true
          },
          "suppressionPath": {
            "title": "Suppression path",
            "description": "Signal K which can be toggled to suppress output on this channel",
            "type": "string"
          }
        },
        "required" : [ "name", "path", "triggerStates" ],
        "default": []
      }
    },
    "pushNotifications": {
      "title": "Push notifications",
      "description": "Issue push notifications when alarm conditions appear",
      "type": "object",
      "properties": {
        "enabled": {
          "title": "Enable push notifications",
          "description": "Issue push notifications when alarm conditions appear",
          "type": "boolean"
        },
        "triggerStates": {
          "title": "Trigger states",
          "description": "Alarm states which will raise push notifications",
          "type": "array",
          "items": {
            "type": "string",
            "enum": [ "warn", "alert", "alarm", "emergency" ]
          },
          "uniqueItems": true
        },
        "resourcesProviderId": {
          "title": "Resources provider",
          "description": "Resources provider used to persist notification subscriptions",
          "type": "string"
        },
        "resourceType": {
          "title": "Resources type",
          "description": "Resources type used to persist notification subscriptions",
          "type": "string"
        }
      },
      "default": { "enabled": false, "triggerStates": [ "emergency" ], "resourcesProviderId": "resources-provider", "resourceType": "alarm-manager" }
    },
    "defaultMethods" : {
      "title": "Default methods",
      "description": "The notification methods to use if none are specified in key metadata",
      "type": "object",
      "properties": {
        "alert" : {
          "type" : "array",
          "items": {
            "type": "string",
            "enum": [ "sound", "visual" ]
          },
          "uniqueItems": true
        },
        "warn" : {
          "type" : "array",
          "items": {
            "type": "string",
            "enum": [ "sound", "visual" ]
          },
          "uniqueItems": true
        },
        "alarm" : {
          "type" : "array",
          "items": {
            "type": "string",
            "enum": [ "sound", "visual" ]
          },
          "uniqueItems": true
        },
        "emergency" : {
          "type" : "array",
          "items": {
            "type": "string",
            "enum": [ "sound", "visual" ]
          },
          "uniqueItems": true
        }
      },
      "default": {
        "alert": [ "visual" ],
        "warn": [ "visual" ],
        "alarm": [ "sound", "visual" ],
        "emergency": [ "sound", "visual" ]
      }
    }
  }
};
const PLUGIN_UISCHEMA = {};

const ALARM_STATES = [ "nominal", "normal", "alert", "warn", "alarm", "emergency" ];
const VAPID_DETAILS = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: process.env.VAPID_SUBJECT
};

module.exports = function (app) {
  var plugin = {};
  var unsubscribes = [];
  var resistantUnsubscribes = [];
  var alarmPaths = [];
  var notificationDigest = { };

  plugin.id = PLUGIN_ID;
  plugin.name = PLUGIN_NAME;
  plugin.description = PLUGIN_DESCRIPTION;
  plugin.schema = PLUGIN_SCHEMA;
  plugin.uiSchema = PLUGIN_UISCHEMA;

  const log = new Log(plugin.id);
  
  plugin.start = function(options, restartPlugin) {
    var numberOfAvailablePaths = 0;

    // Make plugin.options to get scope outside of just start(),
    // populating defaults and saving to configuration.
    options.digestPath = options.digestPath || plugin.schema.properties.digestPath.default;
    options.ignorePaths = options.ignorePaths || plugin.schema.properties.ignorePaths.default;
    options.outputs = options.outputs || plugin.schema.properties.outputs.default;
    options.pushNotifications = { ...plugin.schema.properties.pushNotifications.default, ...(options.pushNotifications || {})};
    options.defaultMethods = { ...plugin.schema.properties.defaultMethods.default, ...(options.defaultMethods || {})};
    plugin.options = options;
    app.savePluginOptions(plugin.options, ()=>{});
    app.debug("using configuration:\n%s", JSON.stringify(plugin.options, null, 2));

    // Subscribe to any suppression paths configured for the output
    // channels and persist these across the lifetime of the plugin.
    if (plugin.options.outputs) {
      plugin.options.outputs.forEach(output => {
        var stream = app.streambundle.getSelfStream(output.suppressionPath);
        resistantUnsubscribes.push(stream.skipDuplicates().onValue(v => {
          if (v == 1) {
            Object.keys(notificationDigest).forEach(key => {
              if (!notificationDigest[key].suppressedOutputs.includes(output.name)) notificationDigest[key].suppressedOutputs.push(output.name);
            })     
          }
        }));
      });
    }

    // Subscribe to server events so that we can keep track of keys
    // that dynamically appear. If there are changes of this sort, then
    // unsubscribe from any previously used keys and start monitoring
    // the new ones.
    app.on('serverevent', (e) => {
      if ((e.type) && (e.type == "SERVERSTATISTICS") && (e.data.numberOfAvailablePaths)) {
        var availableAlarmPaths = getAlarmPaths(app.streambundle.getAvailablePaths(), plugin.options.ignorePaths, plugin.options.defaultMethods);
        if (!compareAlarmPaths(alarmPaths, availableAlarmPaths)) {
          alarmPaths = availableAlarmPaths;
          if (unsubscribes.length > 0) { unsubscribes.forEach(f => f()); unsubscribes = []; }
          log.N("monitoring %d alarm path%s", alarmPaths.length, (alarmPaths.length == 1)?"":"s");
          if (plugin.options.pushNotifications.enabled === true) log.N("push notifications are enabled for %s", plugin.options.pushNotifications.triggerStates, false);
          startAlarmMonitoring(alarmPaths, notificationDigest, unsubscribes);
        }
      }
    });
  }

  plugin.stop = function() {
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
    router.post('/subscribe/:id', handleRoutes);
    router.delete('/unsubscribe/:id', handleRoutes);
    router.patch('/notify/:id', handleRoutes);
  }

  plugin.getOpenApi = function() {
    require("./resources/openApi.json");
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
      var meta = app.getSelfPath(path + ".meta");
      let zones = meta.zones.sort((a,b) => (ALARM_STATES.indexOf(a.state) - ALARM_STATES.indexOf(b.state)));
      zones.forEach(zone => { zone.method = (meta[zone.state + "Method"])?meta[zone.state + "Method"]:[]; });
      var stream = app.streambundle.getSelfStream(path);
      unsubscribes.push(stream.skipDuplicates().onValue(v => {
        var updated = false;
        var notification = getAlarmNotification(v, zones);
        if (notification) { // Value is alarming...
          if ((!digest[path]) || (digest[path].notification.state != notification.state)) {
            app.debug("issuing '%s' notification on '%s'", notification.state, path);
            digest[path] = { "notification": notification, "suppressedOutputs": [] };
            (new Delta(app, plugin.id)).addValue("notifications." + path, notification).commit().clear();
            if (plugin.options.pushNotifications.enabled) {
              if (plugin.options.pushNotifications.triggerStates.includes(notification.state)) {
                log.N("issueing push notifications");
                issuePushNotificationsToSubscribers(path, v, notification);
              }
            }
            updated = true;
          }
        } else {
          if (digest[path]) {
            app.debug("cancelling notification on '%s'", path);
            delete digest[path];
            (new Delta(app, plugin.id)).addValue("notifications." + path, null).commit().clear();
            updated = true;
          }
        }
        if (updated) {
          (new Delta(app, plugin.id)).addValue(plugin.options.digestPath, digest).commit().clear();
          if (plugin.options.outputs) {
            plugin.options.outputs.forEach(output => {
              var currentDigestStates = Object.keys(digest)
              .filter(key => !digest[key].suppressedOutputs.includes(output.name))
              .map(key => digest[key].notification.state);
              updateOutput(output, (output.triggerStates.filter(state => currentDigestStates.includes(state)).length > 0)?1:0);
            });
          }
        }
      }));
    });
  }

  function updateOutput(output, state) {
    var matches;
    if ((matches = output.path.match(/^electrical\.switches\.(.*)\.state$/)) && (matches == 2)) {
      if (output.lastUpdateState != state) {
        app.debug("updating switch output '%s' to state %d", output.name, state);
        app.putSelfPath(path, state);
        output.lastUpdateState = state;
      }
    } else if ((matches = output.path.match(/^notifications\.(.*)\:(.*)\:(.*)$/)) && (matches.length == 4)) {
      var notificationState = (state)?matches[2]:matched[3];
      if (output.lastUpdateState != state) {
        (new Delta(app, plugin.id)).addValue("notifications." + matches[1], { 'message': 'Alarm manager output', 'state': notificationState, 'method': [] }).commit().clear();
        output.lastUpdateState = state;
      }
    } else if ((matches = output.path.match(/^notifications\.(.*)\:(.*)$/)) && (matches.length == 3)) {
      notificationState = (state)?matches[2]:null;
      if (output.lastUpdateState != state) {
        (new Delta(app, plugin.id)).addValue("notifications." + matches[1], (state)?{ 'message': 'Alarm manager output', 'state': notificationState, 'method': [] }:null).commit().clear();
        output.lastUpdateState = state;
      }
    } else if ((matches = output.path.match(/^notifications\.(.*)$/)) && (matches.length == 2)) {
      notificationState = (state)?'normal':null;
      if (output.lastUpdateState != state) {
        app.debug("updating switch output '%s' to state %d", output.name, state);
        (new Delta(app, plugin.id)).addValue("notifications." + matches[1], (state)?{ 'message': 'Alarm manager output', 'state': notificationState, 'method': [] }:null).commit().clear();
        output.lastUpdateState = state;
      }
    } else {
      throw new Error(output.path);
    }
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
  function getAlarmPaths(availablePaths, ignorePaths, defaultMethods) {
    var retval = availablePaths
      .filter(p => (!(ignorePaths.reduce((a,ip) => { return(p.startsWith(ip)?true:a); }, false))))
      .filter(p => {
        var meta = app.getSelfPath(p + ".meta");
        if ((meta) && (meta.zones) && (meta.zones.length > 0)) {
          meta.alertMethod = (meta.alertMethod || defaultMethods.alert);
          meta.warnMethod = (meta.warnMethod || defaultMethods.warn);
          meta.alarmMethod = (meta.alarmMethod || defaultMethods.alarm);
          meta.emergencyMethod = (meta.emergencyMethod || defaultMethods.emergency);
          return(true);
        } else {
          return(false);
        }
      });
    return(retval.sort());
  }

  /**
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
    app.debug("processing %s request on %s", req.method, req.path);
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
            throw new Error("404");
          }
          break;
        case '/suppress':
          if (plugin.options.outputs.map(output => output.name).includes(req.params.name)) {
            Object.keys(notificationDigest).forEach(key => {
              if (!notificationDigest[key].suppressedOutputs.includes(req.params.name)) notificationDigest[key].suppressedOutputs.push(req.params.name);
            });
            expressSend(res, 200, null, req.path);
          } else {
            throw new Error("404");
          }
          break;
        case '/subscribe':
          var subscriberId = req.params.id;
          var subscription = req.body;
          app.debug("received subscribe request for %s (%s)", subscriberId, JSON.stringify(subscription));
          if ((typeof subscription === 'object') && (!Array.isArray(subscription)) && (subscriberId)) {
            app.resourcesApi.setResource(
              plugin.options.pushNotifications.resourceType,
              subscriberId,
              subscription,
              plugin.options.pushNotifications.resourcesProviderId
            ).then(() => {
              expressSend(res, 200, null, req.path);
            }).catch((e) => {
              throw new Error("503");
            });
          } else {
            throw new Error("400");
          }
          break;
        case '/unsubscribe':
          var subscriberId = req.params.id;
          app.debug("received unsubscribe request for %s", subscriberId);
          if (subscriberId) {
            app.resourcesApi.deleteResource(
              plugin.options.pushNotifications.resourceType,
              subscriberId,
              plugin.options.pushNotifications.resourcesProviderId
            ).then(() => {
              expressSend(res, 200, null, req.path);
            }).catch((e) => {
              console.log(e.message);
              throw new Error("404");
            });
          } else {
            throw new Error("400");
          }
          break;
        case '/notify':
          var subscriberId = req.params.id;
          app.debug("received notify request for %s", subscriberId);
          if (subscriberId) {
            app.resourcesApi.getResource(
              plugin.options.pushNotifications.resourceType,
              subscriberId,
              plugin.options.pushNotifications.resourcesProviderId
            ).then((subscription) => {
              var pushNotification = {
                title: "TEST NOTIFICATION",
                options: {
                  body: "Generated by '" + plugin.id + "' plugin.",
                  timestamp: Math.floor(new Date().getTime() / 1000)
                }
              }
              issuePushNotifications([subscription], pushNotification);
              expressSend(res, 200, null, req.path);
            }).catch((e) => {
              console.log(e.message);
              throw new Error("404");
            });
          } else {
            throw new Error("400");
          }
          break;
      }
    } catch(e) {
      expressSend(res, ((/^\d+$/.test(e.message))?parseInt(e.message):500), null, req.path);
    }

    function expressSend(res, code, body = null, debugPrefix = null) {
      const FETCH_RESPONSES = { 200: null, 201: null, 400: "bad request", 403: "forbidden", 404: "not found", 503: "service unavailable (try again later)", 500: "internal server error" };
      res.status(code).send((body)?body:((FETCH_RESPONSES[code])?FETCH_RESPONSES[code]:null));
      if (debugPrefix) app.debug("%s: %d %s", debugPrefix, code, ((body)?JSON.stringify(body):((FETCH_RESPONSES[code])?FETCH_RESPONSES[code]:null)));
      return(false);
    }
  }

  /********************************************************************
   * PUSH NOTIFICATION HANDLING
   */

  function issuePushNotificationsToSubscribers(path, value, notification) {
    app.debug("generatePushNotifications(%s, ,%s, %s)...", path, value, JSON.stringify(notification));
    app.resourcesApi.listResources(plugin.options.pushNotifications.resourceType, {}, plugin.options.pushNotifications.resourcesProviderId).then((metadata) => {
      var subscribers = (Object.keys(metadata || {})).map(key => metadata[key]);
      var pushNotification = {
        title: notification.state.toUpperCase() + " on " + path,
        options: {
          body: notification.message + "\n" + "Trigger value was " + value + ".",
          timestamp: Math.floor(new Date().getTime() / 1000),
          id: path
        }
      };
      issuePushNotifications(subscribers, pushNotification);
    }).catch((e) => {
      app.debug("error obtaining subscription list (%s)", e.message);
    })
  }

  function issuePushNotifications(subscribers, pushNotification) {
    app.debug("issuePushNotifications(%s, %s", JSON.stringify(subscribers), JSON.stringify(pushNotification));
    pushNotification = JSON.stringify(pushNotification);
    
    subscribers.forEach(subscriber => {
      const subscriberId = subscriber.endpoint.slice(-8);
      try {
        webpush.sendNotification(subscriber, pushNotification, { TTL: 10000, vapidDetails: VAPID_DETAILS }).then(result => {
          app.debug("notification sent to %s (%s)", subscriberId, result.statusCode);
        }).catch(error => {
          app.debug("notification failure for subscriber %s (%s)", subscriberId, error);
        });
      } catch(e) {
        app.debug("webpush failed (%s)", e.message);
      }
    });
  }

  return(plugin);
}
