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

## Configuration

The plugin configuration has the following properties.

| Property name | Value type | Value default                  | Description |
| :------------ | :--------- | :----------------------------- | :---------- |
| digestpath    | String     | 'plugins.alarm-manager.digest' | Where to maintain the alarm notification digest. |
| ignorepaths   | Array      | (see below)                    | Collection of prefixes of paths which should not be monitored. |
| outputs       | Array      | []                             | Collection of *output* objects. |

*ignorepaths* has an internal default of:
```
[ "design.", "electrical.", "environment.", "network.", "notifications.", "plugins", "sensors." ]
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
    "outputs": [
      { "path": "electrical.switches.bank.usb0.1", "triggerstates": [ "warn", "alert", "alarm", "emergency" ] },
      { "path": "electrical.switches.bank.usb0.2", "triggerstates": [ "alarm", "emergency" ] }
    ]
  }
}
```

## Operating principle

The plugin monitors all selected keys in the Signal K tree which have
an associated metadata object that contains a 'zones' property and
which are therefore able to support alarm function.

The plugin waits for values to appear on each key and checks these
against the associated metadata alarm zones configuration: if the key
value falls within an alarm zone then a notification will be issued on
the path 'notifications.*key*' using the rules defined in the *key*'s
metadata zones property.

Each time a notification is issued the alarm digest and any specified
output channel states are updated.

## Author

Paul Reeve <*preeve_at_pdjr_dot_eu*>