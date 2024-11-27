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

import { Delta } from 'signalk-libdelta'

const PLUGIN_ID: string = 'alarm-manager';
const PLUGIN_NAME: string = 'pdjr-skplugin-alarm-manager';
const PLUGIN_DESCRIPTION: string = 'Issue notification and other outputs in response to Signal K alarm conditions.';

const DEFAULT_IGNORE_PATHS: string[] = [ "design.", "electrical.", "environment.", "network.", "notifications.", "plugins.", "sensors." ];
const DEFAULT_DIGEST_PATH: string = `plugins.${PLUGIN_ID}.digest`;
const DEFAULT_KEY_CHANGE_NOTIFICATION_PATH: string = `notifications.plugins.${PLUGIN_ID}.keyChange`;

const ALARM_STATES: string[] = [ "nominal", "normal", "alert", "warn", "alarm", "emergency" ];
const STATE_SCAN_INTERVAL: number = 20;

const PLUGIN_SCHEMA: any = {
  "type": "object",
  "properties": {
    "ignorePaths": {
      "title": "Ignore paths",
      "description": "Paths or path prefixes that should be ignored by the alarm manager",
      "type": "array",
      "items": { "type": "string" },
      "default": DEFAULT_IGNORE_PATHS
    },
    "digestPath": {
      "title": "Digest path",
      "description": "Signal K key that will hold the alarm notification digest",
      "type": "string",
      "default": DEFAULT_DIGEST_PATH
    },
    "keyChangeNotificationPath": {
      "title": "Key change notification path",
      "description": "Issue notification here when key collection changes",
      "type": "string",
      "default": DEFAULT_KEY_CHANGE_NOTIFICATION_PATH
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
        "required" : [ "name", "path", "triggerStates" ]
      }
    }
  }
};
const PLUGIN_UISCHEMA: any = {};

module.exports = function (app: any) {
  var suppressionPathUnsubscribes: (() => void)[] = [];
  var unsubscribes: (() => void)[] = [];
  var stateScanInterval: NodeJS.Timeout | undefined = undefined;

  var pluginConfiguration: PluginConfiguration = <PluginConfiguration>{};

  let plugin: SKPlugin = {
    id: PLUGIN_ID,
    name: PLUGIN_NAME,
    description: PLUGIN_DESCRIPTION,
    schema: PLUGIN_SCHEMA,
    uiSchema: PLUGIN_UISCHEMA,
  
    start: function(options: any) {
      let delta = new Delta(app, plugin.id);

      try {
        pluginConfiguration = createPluginConfiguration(options);
        app.debug(`using configuration: ${JSON.stringify(pluginConfiguration, null, 2)}`)

        if ((pluginConfiguration.outputs) && (pluginConfiguration.outputs.length)) {
          app.setPluginStatus(`Started: operating output channels ${pluginConfiguration.outputs.map((o) => (`'${o.name}'`)).join(', ')}`);
          
          suppressionPathUnsubscribes = openSuppressionPaths(pluginConfiguration);

          stateScanInterval = setInterval(() => { startAlarmMonitoringMaybe(pluginConfiguration) }, (STATE_SCAN_INTERVAL * 1000));

        } else {
          app.setPluginStatus('Stopped: no output channels are configured');
        }
      } catch(e: any) {
        app.setPluginStatus('Stopped: bad or missing configuration');
        app.setPluginError(e.message);
      }
    },

    stop: function() {
      suppressionPathUnsubscribes.forEach((f) => f());
      suppressionPathUnsubscribes = [];

      clearInterval(stateScanInterval);
      stateScanInterval = undefined;

	    unsubscribes.forEach(f => f());
      unsubscribes = [];
    },

    registerWithRouter: function(router: any) {
      router.get('/keys', handleRoutes);
      router.get('/digest', handleRoutes);
      router.get('/outputs', handleRoutes);
      router.get('/output/:name', handleRoutes);
      router.patch('/suppress/:name', handleRoutes);
    },
  
    getOpenApi: function() {
      return(require("./openApi.json"))
    }
  }

  function createPluginConfiguration(options: any): PluginConfiguration {
    app.debug(`createPluginConfiguration(${JSON.stringify(options, null, 2)})`);
    var retval: PluginConfiguration = {
      ignorePaths: options.ignorePaths || DEFAULT_IGNORE_PATHS,
      digestPath: options.digestPath || DEFAULT_DIGEST_PATH,
      keyChangeNotificationPath: options.keyChangeNotificationPath || DEFAULT_KEY_CHANGE_NOTIFICATION_PATH,
      outputs: [],

      notificationDigest: [],
      alarmPaths: []
    };
    options.outputs.forEach((outputOption: any) => {
      if (!outputOption.name) throw new Error('missing \'name\' property');
      if (!outputOption.path) throw new Error('missing \'path\' property');
      if (!outputOption.triggerStates.reduce((a: boolean, v: string) => (a && ALARM_STATES.includes(v)), true)) throw new Error('invalid \'triggerStates\' property');
      var output: Output = {
        name: outputOption.name,
        path: outputOption.path,
        triggerStates: outputOption.triggerStates,
        suppressionPath: outputOption.suppressionPath,
        lastUpdateState: -1,
      };
      pluginConfiguration.outputs.push(output);
    });
    return(retval);

  }

  function openSuppressionPaths(pluginConfiguration: PluginConfiguration): (() => void)[] {
    app.debug(`openSuppressionPaths(${JSON.stringify(pluginConfiguration, null, 2)})`);
    var retval: (() => void)[] = [];
    pluginConfiguration.outputs?.forEach((output: Output) => {
      let stream: any = app.streambundle.getSelfStream(output.suppressionPath);
      retval.push(stream.skipDuplicates().onValue((v: number) => {
        if (v == 1) {
          app.debug(`suppressing output channel '${name}'`);
          Object.keys(pluginConfiguration.notificationDigest).forEach(key => {
            if (!pluginConfiguration.notificationDigest[key].actions.includes(name)) pluginConfiguration.notificationDigest[key].actions.push(name);
          });     
        }
      }));
    });
    return(retval);
  }

  function startAlarmMonitoringMaybe(pluginConfiguration: PluginConfiguration) {
    let availableAlarmPaths = getAvailableAlarmPaths(pluginConfiguration.ignorePaths || []);

    if (!compareAlarmPaths(pluginConfiguration.alarmPaths, availableAlarmPaths)) {
      app.debug(`now monitoring ${availableAlarmPaths.length} alarm path${(availableAlarmPaths.length == 1)?'':'s'}`);
      pluginConfiguration.alarmPaths = availableAlarmPaths;
      if (unsubscribes.length > 0) {
        unsubscribes.forEach(f => f());
        unsubscribes = [];
      }
      if (pluginConfiguration.keyChangeNotificationPath) {
        (new Delta(app, plugin.id)).addValue(pluginConfiguration.keyChangeNotificationPath, { state: "alert", method: [], message: "Monitored key collection has changed" }).commit().clear();
      }
      startAlarmMonitoring(pluginConfiguration);
    }

    function getAvailableAlarmPaths(ignorePaths: string[]) {
      let retval: string[] = app.streambundle.getAvailablePaths()
        .filter((p: string) => (!(ignorePaths.reduce((a,ip) => { return(p.startsWith(ip)?true:a); }, false))))
        .filter((p: string) => { var meta: any = app.getSelfPath(`${p}.meta`); return((meta) && (meta.zones) && (meta.zones.length > 0)); }); 
      return(retval.sort());
    }

    function compareAlarmPaths(a: string[], b: string[]): boolean {
      var retval = false;
      if (a.length !== b.length) return(false);
      for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return(false);
      return(true);
    }

    function startAlarmMonitoring(pluginConfiguration: PluginConfiguration) {
      var delta = new Delta(app, plugin.id);

      pluginConfiguration.alarmPaths.forEach((path: string) => {
        const zones = (app.getSelfPath(`${path}.meta`)).zones.sort((a: any, b: any) => (ALARM_STATES.indexOf(a.state) - ALARM_STATES.indexOf(b.state)));
        unsubscribes.push(app.streambundle.getSelfStream(path).skipDuplicates().map((v: any) => getZoneContainingValue(zones, v)).skipDuplicates((ov: any, nv: any) => (((ov)?ov.state:null) == ((nv)?nv.state:null))).onValue((activeZone: any) => {
          var updated = false;
          if (activeZone) {
            if ((!pluginConfiguration.notificationDigest[path]) || (pluginConfiguration.notificationDigest[path].state != activeZone.state)) {
              app.debug(`issuing '${activeZone.state}' notification on '${path}'`);
              const notification: any = { state: activeZone.state, method: activeZone.method, message: activeZone.message };
              pluginConfiguration.notificationDigest[path] = notification;
              delta.addValue(path, notification).commit().clear();
              updated = true;
            }
          } else {
            app.debug(`cancelling notification on '${path}'`);
            if (pluginConfiguration.notificationDigest[path]) {
              delete pluginConfiguration.notificationDigest[path];
              delta.addValue(path, null).commit().clear();
              updated = true;
            }
          }
          if (updated === true) {
            delta.addValue(app.options.digestPath, pluginConfiguration.notificationDigest).commit().clear();
            pluginConfiguration.outputs.forEach((output: Output) => {
              let activeDigestStates = Object.keys(pluginConfiguration.notificationDigest)
                .filter(key => !pluginConfiguration.notificationDigest[key].actions.includes(output.name)) // discard suppressed notifications
                .map(key => (pluginConfiguration.notificationDigest[key].state));             // isolate the notification's state
              updateOutput(output, (output.triggerStates.reduce((a,state) => (activeDigestStates.includes(state) || a), false))?1:0, path);
            });
          }
        }));
      });

      function getZoneContainingValue(zones: any, value: number) {
        var containingZone: any = null;
        zones.forEach((zone: any) => {
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

      function updateOutput(output: Output, state: number, path: string) {
        var matches: RegExpMatchArray | null;
        var notificationState: string | null;
        var delta = new Delta(app, plugin.id);
      
        if ((matches = output.path.match(/^(notifications\..*)\:(.*)\:(.*)$/)) && (matches.length == 4)) {
          notificationState = (state)?matches[2]:matches[3];
          if (output.lastUpdateState != state) {
            delta.addValue(matches[1], { state: notificationState, method: [], message: path }).commit().clear();
            output.lastUpdateState = state;
          }
        } else if ((matches = output.path.match(/^(notifications\..*)\:(.*)$/)) && (matches.length == 3)) {
          notificationState = (state)?matches[2]:null;
          if (output.lastUpdateState != state) {
            delta.addValue(matches[1], { state: notificationState, method: [], message: path }).commit().clear();
            output.lastUpdateState = state;
          }
        } else if ((matches = output.path.match(/^(notifications\..*)$/)) && (matches.length == 2)) {
          notificationState = (state)?'normal':null;
          if (output.lastUpdateState != state) {
            delta.addValue(matches[1], { state: notificationState, method: [], message: path }).commit().clear();
            output.lastUpdateState = state;
          }
        } else if ((matches = output.path.match(/^(.*)\:(.*)\:(.*)$/)) && (matches.length == 4)) {
          if (output.lastUpdateState != state) {
            app.debug(`updating output '${output.name}' to state ${state}`);
            app.putSelfPath(output.path, (state)?matches[3]:matches[2]);
            output.lastUpdateState = state;
          }
        } else if ((matches = output.path.match(/^(.*)$/)) && (matches.length == 2)) {
          if (output.lastUpdateState != state) {
            app.debug(`updating output '${output.name}' to state ${state}`);
            app.putSelfPath(output.path, (state)?1:0);
            output.lastUpdateState = state;
          }
        } else {
          throw new Error(output.path);
        }
      }  
    }
  }      

  function handleRoutes(req: any, res: any) {
    app.debug(`processing ${req.method} request on '${req.path}'`);
    app.debug(JSON.stringify(req.params));
    try {
      switch (req.path.slice(0, (req.path.indexOf('/', 1) == -1)?undefined:req.path.indexOf('/', 1))) {
        case '/keys':
          expressSend(res, 200, pluginConfiguration.alarmPaths, req.path);
          break;
        case '/digest':
          expressSend(res, 200, pluginConfiguration.notificationDigest, req.path);
          break;
        case '/outputs':
          expressSend(res, 200, pluginConfiguration.outputs.reduce((a: { [id: string]: number }, v: Output) => { a[v.name] = Number(v.lastUpdateState); return(a); }, {}), req.path);
          break;
        case '/output':
          var output: Output | undefined = pluginConfiguration.outputs.reduce((a: Output | undefined, o: Output) => ((o.name == req.params.name)?o:a), undefined);
          if (output) {
            expressSend(res, 200, new Number(output.lastUpdateState || -1), req.path);
          } else {
            expressSend(res, 404, "404: invalid request", req.path);
          }
          break;
        case '/suppress':
          if (pluginConfiguration.outputs.map((output: Output) => output.name).includes(req.params.name)) {
            Object.keys(pluginConfiguration.notificationDigest).forEach(key => {
              if (!pluginConfiguration.notificationDigest[key].suppressedOutputs.includes(req.params.name)) pluginConfiguration.notificationDigest[key].suppressedOutputs.push(req.params.name);
            });
            expressSend(res, 200, null, req.path);
          } else {
            expressSend(res, 404, "404: invalid request", req.path);
          }
          break;
      }
    } catch(e: any) {
      app.debug(e.message);
      expressSend(res, ((/^\d+$/.test(e.message))?parseInt(e.message):500), null, req.path);
    }

    function expressSend(res: any, code: number, body: any | null = null, debugPrefix: string | null = null) {
      const FETCH_RESPONSES: { [id: number]: string | null } = { 200: null, 201: null, 400: "bad request", 403: "forbidden", 404: "not found", 503: "service unavailable (try again later)", 500: "internal server error" };
      res.status(code).send((body)?body:((FETCH_RESPONSES[code])?FETCH_RESPONSES[code]:null));
      if (debugPrefix) app.debug(`${debugPrefix}: ${code} ${(body)?JSON.stringify(body):((FETCH_RESPONSES[code])?FETCH_RESPONSES[code]:null)}`);
      return(false);
    }    
  }

  return(plugin);
}

interface SKPlugin {
  id: string,
  name: string,
  description: string,
  schema: any,
  uiSchema: any,
  
  start: (options: any) => void,
  stop: () => void,
  registerWithRouter: (router: any) => void,
  getOpenApi: () => string
}

interface Output {
  name: string,
  path: string,
  triggerStates: string[],
  suppressionPath?: string,
  lastUpdateState?: number,
}

interface PluginConfiguration {
  ignorePaths: string[],
  digestPath: string,
  keyChangeNotificationPath: string,
  outputs: Output[],

  notificationDigest: { [index: string]: any }
  alarmPaths: string[]
}
