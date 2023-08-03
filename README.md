# pdjr-skplugin-alarm-manager

Issue notification and other outputs in response to Signal K alarm
conditions.

## Description

__pdjr-skplugin-alarm-manager__ implements a centralised mechanism for
issuing alarm notifications contingent upon the alarm configuration
properties embedded in the meta values associated with monitored keys.

The design of the plugin acknowledges the Signal K specification
discussions on 
[Metadata](https://github.com/SignalK/specification/blob/master/gitbook-docs/data_model_metadata.md)
and
[Alarm, Alert, and Notification Handling](https://github.com/SignalK/specification/blob/master/gitbook-docs/notifications.md).

__pdjr-skplugin-alarm-manager__ generates three types of outputs in
response to an alarm condition.

Firstly, it reponds to the requirements of the Signal K specification
by issuing notifications: thus, an alarm triggered by a value on *key*
will raise a notification on 'notifications.*key*' whenever the value
of *key* enters an alarm zone defined in *key*'s metadata.

Secondly, the plugin maintains a digest of current alarm notifications.
The digest is a JSON object whose property names are notified *key*
values and whose property values are the current notification state of
the associated *key*.
This digest provides a convenient data set for use by software
annunciators or other alarm consumers.

Thirdly, the plugin operates zero or more user-defined switch or
notification outputs in response to the system's aggregate alarm
state.
In this context the system alarm state is 'alert' if any individual
alarm is in an 'alert' state and similarly for each possible
notification state.
This allows, for example, the operation of various types of physical
annunciator.

## Operating principle

The plugin monitors all keys in the Signal K tree which have an
associated metadata object that contains a 'zones' property and which
are therefore able to support alarm function.
The scope of monitored keys can be restricted by including in
*ignorepaths* the names of paths which should not be .

Once a key collection is established, the plugin waits for values
appearing on a *key* and checks these against the associated metadata
zones configuration: if the key value falls within an alarm zone
then a notification will be issues on the path 'notifications.*key*'
using the rules defined in the key's metadata.


The correct operation of __pdjr-skplugin-alarm-manager__ depends upon
the presence of meta information at the time a trigger key is
processed.
There is a short period following a server restart during which it is
possible that dynamically generated meta data is not yet in place.
To ensure that alarm conditions are not missed during this critical
phase it is possible to defer the start of alarm processing until a
true-ish condition appears on a trigger key defined by the
configuration __starton__ property.
True-ish means either numeric 1 or the presence of a notification.
If __starton__ is not defined then __pdjr-skplugin-alarm-manager__ will
begin execution immediately on server boo

## Configuration

The plugin configuration has the following properties.

| Property name | Value type | Value default                  | Description |
| :------------ | :--------- | :----------------------------- | :---------- |
| digestpath    | String     | 'plugins.alarm-manager.digest' | Where to save the alarm notification digest. |
| ignorepaths   | Array      | (see below)                    | Collection of prefixes of paths which should not be monitored. |
| outputs       | Array      | []                             | Collection of *output* objects. |

*ignorepaths* has an internal default of:
```
[ "design.", "electrical.", "environment.", "network.", "notifications.", "sensors." ]
```

Each *output* object has the following properties.

| Property name | Value type | Value default | Description |
| :------------ | :--------- | :------------ | :---------- |
| path          | String     | (none)        | Switch path or notification path on which to issue summary outputs. |
| triggerstates | Array      | (none)        | Collection of notification states which trigger this output. |

Each *output* configuration specifies a switch or notification
*path* which will be updated in response to the presence or absence
of one or more alarm notifications in one of the specified
*triggerstates*.

The configuration I use on my boat uses two outputs that operate relays
which are in turn connected to visual and audible annunciators.
```
{
  "enabled": true,
  "enableLogging": false,
  "enableDebug": false,
  "configuration": {
    "ignorepaths": [ "design.", "electrical.", "environment.", "network.", "notifications.", "sensors." ],
    "outputs": [
      { "switchpath": "electrical.switches.bank.usb0.1", "triggerstates": [ "warn", "alert" ] },
      { "switchpath": "electrical.switches.bank.usb0.2", "triggerstates": [ "alarm", "emergency" ] }
    ]
  }
}
```

## Author

Paul Reeve <*preeve_at_pdjr_dot_eu*>