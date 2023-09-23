# pdjr-skplugin-alarm-manager

Issue notification and other outputs in response to Signal K alarm
conditions.

## Description

__pdjr-skplugin-alarm-manager__ implements a centralised mechanism for
the management of alarm conditions in Signal K which arise when key
values enter alarm zones defined by key metadata.
The plugin provides three distinct services.

Firstly, it reponds to the requirements of the Signal K specification
by issuing alarm notifications: thus, a value on '*key*' will raise a
notification on 'notifications.*key*' whenever the value of *key* enters
an alarm zone defined in *key*'s metadata.

Secondly, the plugin maintains a digest of current alarm notifications.
The digest is a JSON object whose property keys are notified *key*s
with the associated notification object as their value.
This digest provides a convenient data set for use by software
annunciators or other alarm consumers.

Thirdly, the plugin operates zero or more user-defined, suppressable,
output channels each with an alarm state that is dependent upon the
alarm states it is configured to respond to and the consolidated alarm
states of notifications in the digest.
In this context 'consolidated' means that if a particular alarm state
is present in any digest notification, then the digest as a whole is
considered to be in that consilidated alarm state.

An active output channel can be suppressed by supplying a transient
true value on a configured key.
Suppression is applied at the digest notification level and applies
to just those alarm states for wghich the output channel is configured.
This means that if a new notification appears or an existing notification
changes state then the alarm channel may go active again.
This mechanism allows the easy implementation of a 'silence alarm'
function on selected output channels.

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

The plugin will use a built-in, default, configuration to raise alarm
notifications and maintain a notification digest. 
If you want to optimise operation of the plugin for your environment
and/or operate alarm output channels then the plugin must be configured
using the Signal K Dashboard's Plugin Config interface or by direct
editing of the plugin's JSON configuration file.

**_Ignore paths_** is a comma-separated list of Signal K paths or path
prefixes which specify keys which should be ignored by the plugin.
Path prefixes should be used to exclude hierarchies of keys which are
of no interest.

**_Digest path_** specifies the Signal K path where the plugin will
maintain its alarm notification digest.

**Outputs...** reveals and hides a list of configured output channels.
Each output channel is defined by the following properties:
<ul>
<p>
<strong>Name</strong> specifies the name of the output channel.</p>
<p>
<strong>Path</strong> specifies the Signal K path which should be
updated with the output channel's state.
The path specified can be either a path under 'electrical.switches.'
or a path under 'notifications.'.</p>
<p>
A path under 'electrical.switches.' will have its state set to 1
when the output channel is triggered, otherwise 0.</p>
<p>
A path under 'notifications.' will receive a 'normal' notification
when the output channel is triggered and the notification will be
removed when the channel is not triggered.
If you prefer a different state to 'normal' then a suffix of the
form ':<em>state</em>' can be added to the specified path.
If you would like a notification to be always present but with
different states for triggered and not triggered, then a suffix
of the form ':<em>triggered</em>:<em>not-triggered</em>' can be
added to the specified path.
<p>
<strong>Trigger states</strong> specifies the alarm states which
should operate the output channel when they are present in any
active alarm notification.</p>
<p>
<strong>Suppression path</strong> specifies a Signal K path which
can be used to suppress output on the channel.
The path specified can be either a path under 'electrical.switches.'
or a path under 'notifications.'.</p>
</ul>

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
