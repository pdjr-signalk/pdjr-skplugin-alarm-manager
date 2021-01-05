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
const Schema = require("./lib/signalk-libschema/Schema.js");
const Delta = require("./lib/signalk-libdelta/Delta.js");

const PLUGIN_SCHEMA_FILE = __dirname + "/schema.json";
const PLUGIN_UISCHEMA_FILE = __dirname + "/uischema.json";
const ALARM_STATES = [ "nominal", "normal", "alert", "warn", "alarm", "emergency" ];
const PLUGIN_DIGEST_KEY = "notifications.plugins.alarm.digest";

module.exports = function (app) {
  var plugin = {};
  var unsubscribes = [];
  var notificationDigest = {};

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
    var stream = (options.starton)?app.streambundle.getSelfStream(options.starton):bacon.constant(1);
    unsubscribes.push(stream.onValue(v => {
      if (v) {
        var paths = getAlarmPaths(app, options.ignorepaths || [ "notifications." ]);
        log.N("alarm system started (monitoring %d key%s)", paths.length, (paths.length == 1)?"":"s");
        paths.forEach(path => {
          var meta = app.getSelfPath(path + ".meta");
          let zones = meta.zones.sort((a,b) => (ALARM_STATES.indexOf(a.state) - ALARM_STATES.indexOf(b.state)));
          zones.forEach(zone => { zone.method = (meta[zone.state + "Method"])?meta[zone.state + "Method"]:[]; });
          var stream = app.streambundle.getSelfStream(path);
          var updated = false;
          unsubscribes.push(stream.skipDuplicates().onValue(v => {
            var notification = alarmCheck(v, zones);
            if (notification) { // Value is alarming...
              if ((!notificationDigest[path]) || (notificationDigest[path].state != notification.state)) {
                notificationDigest[path] = notification;
                log.N("issuing notification on '%s'", path);
                (new Delta(app, plugin.id)).addValue("notifications." + path, notification).commit().clear();
                updated = true;
              }
              if ((updated) && (options.outputs)) {
                var alarmPath = options.outputs.reduce((a,o) => { return((o.triggerstates.includes(notification.state))?o.triggerpath:a); }, null);
                if (alarmPath) app.putSelfPath(alarmPath + ".state", 1);
              }
            } else {
              if (notificationDigest[path]) {
                log.N("cancelling notification on '%s'", path);
                delete notificationDigest[path];
                (new Delta(app, plugin.id)).addValue("notifications." + path, null).commit().clear();
                updated = true;
              }
            }
            if (updated) {
              (new Delta(app, plugin.id)).addValue(PLUGIN_DIGEST_KEY, Object.keys(notificationDigest).map(key => notificationDigest[key])).commit().clear();
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
    zones.forEach(zone => {
      if (((!zone.lower) || (value >= zone.lower)) && ((!zone.upper) || (value <= zone.upper))) {
        var now = Date.now();
        notificationValue = { "state": zone.state, "method": zone.method, "message": zone.message, "id": now };
      }
    });
    return(notificationValue);
  }

  function getAlarmPaths(app, ignore=[]) {
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
