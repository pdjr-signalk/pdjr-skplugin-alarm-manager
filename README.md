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

__pdjr-skplugin-alarm-manager__ generates three types of output in
response to an alarm condition.

Firstly, it reponds to the requirements of the Signal K specification
by issuing notifications: thus, an alarm triggered by a value on *key*
will raise a notification on 'notifications.*key*' whenever the value
of *key* enters an alarm zone defined in *key*'s metadata.

Secondly, the plugin maintains a digest of current alarm notifications.
The digest is a JSON object whose properties are notified *key*s with
values equivalent to their associated notification.
This digest provides a convenient data set for use by software
annunciators or other alarm consumers.

Thirdly, the plugin operates zero or more user-defined, suppressable,
switch or notification outputs dependent upon the alarm states present
in the digest.
This allows, for example, the operation of an indicator when a warning
or alert state is present and an audible alarm when an alarm or
emergency state is present.
Each output can be suppressed by the appearance of a transient true
value on an associated key allowing the easy implementation of a
'silence alarm' function. 

## Configuration

The plugin configuration has the following properties.

<table>
<tr><th>Property&nbsp;name</th><th>Value&nbsp;default</th><th>Description</th></tr>
<tr>
<td>digestPath</td>
<td><pre>'plugins.alarm-manager.digest'</pre></td>
<td>Signal K path to the alarm notification digest.</td>
</tr>
<tr>
<td>ignorePaths</td>
<td><pre>
[
  "design.",
  "electrical.",
  "network.",
  "notifications.",
  "plugins."
]
</pre></td>
<td>Collection of pathnames or prefixes of pathnames which should not be monitored.</td>
</tr>
<tr>
<td>outputs</td>
<td><pre>[]</pre></td>
<td>Collection of *output* objects (see below).</td>
</tr>
<tr>
<td>defaultMethods</td>
<td><pre>
{
  "alertMethod": [
    "visual"
  ],
  "warnMethod": [
    "visual"
  ],
  "alarmMethod": [
    "sound",
    "visual"
  ],
  "emergencyMethod": [
    "sound",
    "visual"
  ]
}
</pre></td>
<td>
The Signal K specification allows the metadata for every path to
specify the methods that should be used when raising a particular
type of alarm for that path.
These fallback defaults specify what methods should be used if the
metadata method specification on a path is partial or entirely absent.
</td>
</tr>
</table>

Each *output* object has the following properties.
<table>
<tr><th>Property&nbsp;name</th><th>Value&nbsp;default</th><th>Description</th></tr>
<tr>
<td>path</td>
<td>(none)</td>
<td>Switch or notification path.</td>
</tr>
<tr>
<td>triggerStates</td>
<td>(none)</td>
<td>Array of alarm states.</td>
</tr>
</table>

Each item in the *output* array specifies a switch or notification
*path* which will be updated in response to the presence or absence
of one or more alarm notifications in one of the specified
*triggerStates*.

The configuration I use on my boat uses two outputs that operate relays
which are in turn connected to visual and audible annunciators.
```
{
  "enabled": true,
  "enableLogging": false,
  "enableDebug": false,
  "configuration": {
    "outputs": [
      { "path": "electrical.switches.bank.usb0.1", "triggerStates": [ "warn", "alert", "alarm", "emergency" ] },
      { "path": "electrical.switches.bank.usb0.2", "triggerStates": [ "alarm", "emergency" ] }
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