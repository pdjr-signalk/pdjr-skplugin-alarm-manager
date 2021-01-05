# signalk-alarm

Alarm plugin with webapp support.

__signalk-alarm__ implements a centralised mechanism for issuing alarm
notifications contingent upon the alarm configuration properties
embedded in the meta values associated with monitored keys.

The design of the plugin acknowledges
[this discussion](https://github.com/SignalK/specification/blob/master/gitbook-docs/data_model_metadata.md).
in the
[Signal K Specification](https://github.com/SignalK/specification).

As well as issuing alarm notification under the "notifications." tree,
__signalk-alarm__ maintains a digest of active alarm notifications at
"notifications.plugins.alarm.digest".
The digest is simply an array of all currently active notifications and
provides a convenient data set for use by other plugins and webapps.
A simple [alarm widget](https://github.com/preeve9534/signalk-alarm-widget)
illustrates how the digest might be used in a Signal K webapp.

## Operating principle

The keys which __signalk-alarm__ monitors are defined in the plugin
configuration file __paths__ property as a collection of terminal
paths.
In future releases it may be possible to specify alarm keys using
partial paths and or regular expressions.

Values appearing on an alarm *key* are checked against the associated
meta zones configuration and if the value falls within a defined zone
the __signalk-alarm__ will issue a notification on the path
"notifications.*key*" using the rules defined in the meta.

__signalk-alarm__ can also be used to update values on some output
channels defined under the __outputs__ configuration property.
This feature is intended to allow the plugin to operate one or more
output relays in response to the presence or absence of active alarm
notifications: this can be used to trigger external annunciators
in response to internal alarm states.

The correct operation of __signalk-alarm__ depends upon the presence
of meta information at the time a trigger key is processed and for a
short time following a server restart it may be that dynamically
generated meta data is not yet in place.
To ensure that alarm conditions are not missed during this critical
phase it is possible to defer the start of alarm processing until a
true-ish condition appears on a trigger key defined by the configuration
__starton__ property.
True-ish means either numeric 1 or the presence of a notification.

## Example configuration
```
{
  "enabled": true,
  "enableLogging": false,
  "enableDebug": false,
  "configuration": {
    "paths": [
      "tanks.freshWater.1.currentLevel",
      "tanks.freshWater.2.currentLevel",
      "tanks.fuel.3.currentLevel",
      "tanks.fuel.4.currentLevel",
      "tanks.wasteWater.0.currentLevel"
    ],
    "starton": "notifications.plugins.meta.status",
    "outputs": [
      {
        "switchpath": "electrical.switches.bank.usb0.1",
        "triggerstates": [ "warn", "alert" ]
      },
      {
        "switchpath": "electrical.switches.bank.usb0.1",
        "triggerstates": [ "warn", "alert" ]
      }
    ]
  }
}
```
