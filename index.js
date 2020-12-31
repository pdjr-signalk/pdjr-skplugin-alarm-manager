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
const Schema = require("./lib/signalk-libschema/Schema.js");
const Delta = require("./lib/signalk-libdelta/Delta.js");

const PLUGIN_SCHEMA_FILE = __dirname + "/schema.json";
const PLUGIN_UISCHEMA_FILE = __dirname + "/uischema.json";
const ALARM_STATES = [ "nominal", "normal", "alert", "warn", "alarm", "emergency" ];
const META_PLUGIN_STATUS_NOTIFICATION_KEY = "notifications.plugins.meta.status";
const META_PLUGIN_STATUS_NOTIFICATION_KEY_READY_VALUE = "complete";
const PLUGIN_DIGEST_KEY = "notifications.plugins.alarm.digest";

module.exports = function (app) {
  var plugin = {};
  var unsubscribes = [];
  var alarmZones = {};

  plugin.id = 'alarm';
  plugin.name = 'Alarm notification generator';
  plugin.description = 'Inject alarm notifications into Signal K';

  const log = new Log(plugin.id, { ncallback: app.setPluginStatus, ecallback: app.setPluginError });

  plugin.schema = function() {
    var schema = Schema.createSchema(PLUGIN_SCHEMA_FILE);
    return(schema.getSchema());
  };

  plugin.uiSchema = function() {
    var schema = Schema.createSchema(PLUGIN_UISCHEMA_FILE);
    return(schema.getSchema());
  }

  plugin.start = function(options) {
    var stream = app.streambundle.getSelfStream(META_PLUGIN_STATUS_NOTIFICATION_KEY);
    unsubscribes.push(stream.onValue(v => {
      if (v.message == META_PLUGIN_STATUS_NOTIFICATION_KEY_READY_VALUE) {
        log.N("alarm system started (monitoring %d key%s)", options.paths.length, (options.paths.length == 1)?"":"s");
        options.paths.forEach(path => {
          var stream = app.streambundle.getSelfStream(path);
          unsubscribes.push(stream.onValue(v => {
            if (!alarmZones[path]) {
              var meta = app.getSelfPath(path + ".meta");
              if (meta) {
                var zones = meta.zones.sort((a,b) => (ALARM_STATES.indexOf(a.state) - ALARM_STATES.indexOf(b.state)));
                zones.forEach(zone => { zone.method = (meta[zone.state + "Method"])?meta[zone.state + "Method"]:[]; });
                alarmZones[path] = { zones: zones, lastNotification: null };
              }
            } else {
              if (alarmZones[path]) {
                var notificationValue = alarmCheck(v, alarmZones[path].zones);
                var ncv = (notificationValue)?notificationValue.state:notificationValue;
                var lcv = (alarmZones[path].lastNotification)?alarmZones[path].lastNotification.state:null;
                if (ncv != lcv) {
                  alarmZones[path].lastNotification = notificationValue;
                  var delta = new Delta(app, plugin.id);
                  delta.addValue("notifications." + path, notificationValue);
                  var activeNotifications = Object.keys(alarmZones).reduce((a,k) => { if (alarmZones[k].lastNotification) a.push(alarmZones[k].lastNotification); return(a); }, []);
                  delta.addValue(PLUGIN_DIGEST_KEY, activeNotifications);
                  delta.commit();
                  if (options.output1) app.putSelfPath(options.output1 + ".state", (activeNotifications.length)?1:0, (d) => app.debug("put response: %s", d.message));
                }
              }
            }
          }));
        });
      }
    }));
  }

  plugin.stop = function() {
	unsubscribes.forEach(f => f());
    var unsubscribes = [];
  }

  function alarmCheck(value, zones) {
    var notificationValue = null;
    if (zones) {
      zones.forEach(zone => {
        if (((!zone.lower) || (value >= zone.lower)) && ((!zone.upper) || (value <= zone.upper))) {
          var now = Date.now();
          notificationValue = { "state": zone.state, "method": zone.method, "message": zone.message, "id": now };
        }
      });
    }
    return(notificationValue);
  }

  return(plugin);
}
