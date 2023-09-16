# pdjr-skplugin-alarm-manager

Issue notification and other outputs in response to Signal K alarm
conditions.

## Description

__pdjr-skplugin-alarm-manager__ implements a centralised mechanism for
the management of alarm conditions in Signal K which arise when key values
enter the alarm zones defined by key metadata.
The plugin provides three distinct services.

Firstly, it reponds to the requirements of the Signal K specification
by issuing alarm notifications: thus, a value on '*key*' will raise a
notification on 'notifications.*key*' whenever the value of *key* enters
an alarm zone defined in *key*'s metadata.

Secondly, the plugin maintains a digest of current alarm notifications.
The digest is a JSON object whose properties are notified *key*s with
values equivalent to their associated notification.
This digest provides a convenient data set for use by software
annunciators or other alarm consumers.

Thirdly, the plugin operates zero or more user-defined, suppressable,
switch or notification outputs with values dependent upon the
consolidated alarm states of notifications in the digest.
Outputs can be individually suppressed by the appearance of a transient
true value on a specified key allowing the easy implementation of a
'silence alarm' function.

I use this last feature to operate a visual indicator when a warning
or alert state is present in Signal K and an audible alarm when an alarm
or emergency state is present.

The plugin exposes an
[HTTP API](https://pdjr-signalk.github.io/pdjr-skplugin-alarm-manager/)
and contributes OpenAPI documentation of its interface to the Signal
K OpenAPI service.

The design of the plugin acknowledges the Signal K specification
discussions on 
[Metadata](https://github.com/SignalK/specification/blob/master/gitbook-docs/data_model_metadata.md)
and
[Alarm, Alert, and Notification Handling](https://github.com/SignalK/specification/blob/master/gitbook-docs/notifications.md).

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
<td>
Switch or notification path.
Required.
</td>
</tr>
<tr>
<td>triggerStates</td>
<td>(none)</td>
<td>
Array of alarm states which will trigger this output.
Required.
</td>
</tr>
<tr>
<td>suppressionPath</td>
<td>(none)</td>
<td>
Path signalling suppression of this output.
Optional.
</td>
</tr>
</table>

Each item in the *output* array specifies a switch or notification
*path* which will be updated in response to the presence or absence
of one or more alarm notifications in one of the specified
*triggerStates*.

A momentary true value on *suppressionPath* will suppress output
deriving from the current notification state, but output will be
restored if a notification changes state to another value in
*triggerStates* or a new notification appears with a state in
*triggerStates*.

The configuration I use on my boat uses two outputs that operate relays
which are in turn connected to visual (usb0.1) and audible (usb0.2)
annunciators.
A momentary switch allows suppression of the audible output.
```
{
  "enabled": true,
  "enableLogging": false,
  "enableDebug": false,
  "configuration": {
    "outputs": [
      {
        "path": "electrical.switches.bank.usb0.1",
        "triggerStates": [ "warn", "alert", "alarm", "emergency" ]
      },
      {
        "path": "electrical.switches.bank.usb0.2",
        "triggerStates": [ "alarm", "emergency" ],
        "suppressionPath": "electrical.switches.bank.0.12.state"
      }
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
