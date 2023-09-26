# pdjr-skplugin-alarm-manager

Issue notification and other outputs in response to Signal K alarm
conditions.

## Description

__pdjr-skplugin-alarm-manager__ implements a centralised mechanism for
the management of alarm conditions in Signal K which arise when key
values enter alarm zones defined by key metadata.
The plugin provides four distinct services.

Firstly, it reponds to the requirements of the Signal K specification
by issuing alarm notifications: thus, a value on '*key*' will raise a
notification on 'notifications.*key*' whenever the value of *key* enters
an alarm zone defined in *key*'s metadata.

Secondly, the plugin maintains a digest of current alarm notifications.
The digest is a JSON object whose property keys are notified *key*s
with the associated notification object as their value.
This digest provides a convenient data set for use by software
annunciators or other alarm consumers.

Thirdly, the plugin operates zero or more suppressable output channels
each of which is configured to react to one or more alarm state triggers.
When an alarm notification with one of the configured trigger states is
raised the output channel is enabled.

An active output channel can be suppressed by supplying a transient
true value on a configured key.
Suppression is applied at the digest notification level and applies
to just those alarm states for which the output channel is configured.
This means that if a new notification appears or an existing
notification adopts a new trigger state then the alarm output channel
will go active again.
This mechanism allows the easy implementation of a 'silence alarm'
function on selected output channels.

Finally and optionally, the plugin will attempt to send push
notifications to subscribed devices.
This feature is disabled by default and full functionality will
require non-trivial configuration of the Signal K host operating
environment.
See the discussion below.

The plugin provides a simple Wepapp that summarises the current
alarm state and supports subscription, unsubscription and testing of
the push notification feature.

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

**_Outputs..._** reveals and hides a list of configured output channels.
Each output channel is defined by the following properties:
<ul>
<p>
<strong><em>Name</em></strong> specifies the name of the output channel.</p>
<p>
<strong><em>Path</em></strong> specifies the Signal K path which should be
updated with the output channel's state.
This can be either a path under 'electrical.switches.' or a path under
'notifications.'.</p>
<p>
A path under 'electrical.switches.' will have its state set to 1
when the output channel is triggered, otherwise 0.</p>
<p>
A simple path under 'notifications.' should have the form:</p>
<p>
<ul>
<em>notification_path</em>[:<em>on_state</em>[:<em>off_state</em>]]
</ul></p>
<em>notification_path</em> will receive a notification when the
output channel is triggered.
In the absence of <em>on_state</em> the state of the notification
will be set to the most serious of the triggering notification
states and otherwise to <em>on_state</em>.
In the absence of <em>off_state</em> the notification will be
deleted when the channel is not triggered and otherwise set to
<em>off_state</em></off>.</p>
<p>
<strong><em>Trigger states</em></strong> specifies the alarm states
which should operate the output channel when they are present in any
active alarm notification.</p>
<p>
<strong><em>Suppression path</em></strong> specifies a Signal K path
which can be used to suppress output on the channel.
The path specified can be either a path under 'electrical.switches.'
or a path under 'notifications.'.</p>
<p>
The arrival of a momentary 1 on a path under 'electrical.switches.'
will suppress the output channel until the arrival of a new
triggering event.</p> 
<p>
A path under 'notifications.' should have the form:</p>
<p>
<ul>
<em>notification_path</em>[:<em>on_state</em>]
</ul></p>
<p>
The arrival of a momentary notification on 'notification_path' will
suppress the output channel.
If <em>on_state</em> is specified then the suppression will only happen
if the arriving notification has a state equal to <em>on_state</em>.</p>
</ul>

**_Default methods..._** reveals and hides the specification of the
suggested methods which will be applied to Signal K keys for each
possible alarm state when key metadata does not include an explicit
method property.

### Example configuration

I use this last feature to operate a visual indicator when a warning
or alert state is present in Signal K and an audible alarm when an alarm
or emergency state is present.

The configuration I use on my boat uses two relay outputs and a
switch input:

* 'electrical.switches.bank.usb0.1' operates an LED beacon;
* 'electrical.switches.bank.usb0.2' operates an audible sounder;
* 'electrical.switches.bank.0.12.state' senses a momentary panel switch.
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

### Push notifications

Getting a pop-up notification on an arbitrary device when an alarm
notification is raised in Signal K is a non-trivial problem.
Push notification protocols require SSL and in the real world the
use of SSL relies on devices having 'real' IP addresses and access
to a fully-connected DNS service and Internet-based certification
services.
Devices on a private LAN with perhaps intermittent Internet access
cannot easily use SSL, but here is one way which works.

The plugin persists push notification user/device subscriptions
using a Signal K resources provider.
By default it uses Signal K's built-in 'resources-provider'
plugin.
1. Configure Signal K to operate using SSL. Run 'signalk-server-setup'
   and enter 'y' in response to the 'Do you want to enable SSL?'
   prompt.

2. Configure storage for push notification subscriptions.
   Go to the Signal K dashboard and configure the 'Resources Provider
   (built-in)' plugin to support the 'alarm-manager' custom resource
   type.

3. In the unlikely circumstance that you have a UI and web-browser on
   the same device as your Signal server then you can check that things
   are working by opening the plugin's Webapp, clicking the 'Subscribe'
   and button and allowing notifications from 'localhost' in the
   ensuing, browser-generated, dialogue.
   Once subscribed, if you then click the 'Test' button you should
   receive a push notification which confirms that the plugin is working.

   Repeating this procedure from a device other than the Signal K
   server will fail because the Signal K server and client are unable
   to authenticate one-another without Internet access and the benefits
   that come with 'real' IP addresses.
   One way around this problem is to manually provide the required
   authentication certficates and there are few, mostly esoteric, ways
   of achieving this.

4. 

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
