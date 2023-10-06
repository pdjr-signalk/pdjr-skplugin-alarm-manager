# pdjr-skplugin-alarm-manager

Issue notification and other outputs in response to Signal K alarm
conditions.

## Description

__pdjr-skplugin-alarm-manager__ implements a centralised mechanism for
detecting and actioning alarm conditions which arise when the value of
a Signal K key enters an alarm zone defined by the key's metadata.

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

Thirdly, the plugin operates zero or more suppressable output channels
which are configured to react to one or more alarm method triggers.
When an alarm notification with one of the configured method trigger
states is raised the output channel is enabled.

An active output channel can be suppressed by supplying a transient
true value on a configured key.
Suppression is operates at the digest notification level and applies
to just those alarm states for which the output channel is configured
and which are being notified at the moment of suppression.
This means that if a new notification appears or an existing
notification changes state then the alarm output channel
will go active again.
This mechanism allows the easy implementation of a 'silence alarm'
function.

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
using Signal K's 'Plugin Config' interface or by direct editing of the
plugin's JSON configuration file.

<dl>
  <dt>Ignore paths (<code>ignorePaths</code>)</dt>
    <dd>
      Must provide a comma-separated list of Signal K paths or path prefixes
      which specify keys which should be ignored by the plugin.
      <p>
      Path prefixes should be used to exclude hierarchies of keys which are
      of no interest.
      </p>
    </dd>
  <dt>Digest path (<code>digestPath</code>)</dt>
    <dd>
      Must specify the Signal K path where the plugin will maintain its alarm
      notification digest.
    </dd>
  <dt>Outputs... <code>outputs</code></dt>
    <dd>
      Reveals and hides a list of configured output channels each of which is
      defined by the following properties.
      <dl>
        <dt>Name <code>name</code></dt>
          <dd>
            Specifies a name for the output channel.
          </dd>
        <dt>Path <code>path</code></dt>
          <dd>
            Specifies the Signal K path which should be updated with the output
            channel's state.
            This can be either a path under 'electrical.switches.' or a path under
            'notifications.'.
            <p>
            A path under 'electrical.switches.' will have its state set to 1
            when the output channel is triggered, otherwise 0.</p>
            <p>
            A path under 'notifications.' should have the form
            <em>notification_path</em>[<strong>:</strong><em>on_state</em>[<strong>:</strong><em>off_state</em>]].
            <p>
            <em>notification_path</em> will receive a notification when the
            output channel is triggered with a 'state' property set, in the
            absence of <em>on_state</em>, to the most serious of the triggering
            alarm notification states and otherwise to <em>on_state</em>. 
            <p>
            In the absence of <em>off_state</em> the notification will be
            deleted when the output channel stops being triggered and will
            otherwise have its notification state set to <em>off_state</em>.
          </dd>
        <dt>Trigger states <code>triggerStates</code></dt>
          <dd>
            Specifies the alarm states which should operate the output channel
            when they are present in any active alarm notification.
          </dd>
        <dt>Suppression path <code>suppressionPath</code></dt>
          <dd>
            Specifies a Signal K path which can be used to suppress output on the
            channel.
            The path specified can be either a path under 'electrical.switches.'
            or a path under 'notifications.'.
            <p>
            The arrival of a momentary 1 on a path under 'electrical.switches.'
            will suppress the output channel until the arrival of a new
            triggering event. 
            <p>
            A path under 'notifications.' should have the form:</p>
            <em>notification_path</em>[<strong>:</strong><em>on_state</em>]
            <p>
            The arrival of a momentary notification on <em>notification_path</em> will
            suppress the output channel.
            If <em>on_state</em> is specified then the suppression will only happen
            if the arriving notification has a state equal to <em>on_state</em>.
          </dd>
      </dl>
  <dt>Methods... <code>methods</code></dt>
    <dd>
    Reveals and hides the configuration of the suggested methods which will
    be applied to Signal K keys for each possible alarm state when key metadata
    does not include an explicit method property.
    <dl>
      <dt>Custom methods <code>customMethods</code></dt>
      <dd>
        A comma-separated list of method names which can be applied to
        notifications in addition to the Signal K defaults of 'sound'
        and 'visual'.
      </dd>
      <dt>Methods used for ALERT <code>alert</code></dt>
      <dd>
        Methods to be included in the 'method' property of notifications
        with a state property value of 'alert'.
      </dd>
      <dt>Methods used for WARN <code>warn</code></dt>
      <dd>
        Methods to be included in the 'method' property of notifications
        with a state property value of 'warn'.
      </dd>
      <dt>Methods used for ALARM <code>alarm</code></dt>
      <dd>
        Methods to be included in the 'method' property of notifications
        with a state property value of 'alarm'.
      </dd>
      <dt>Methods used for EMERGENCY <code>emergency</code></dt>
      <dd>
        Methods to be included in the 'method' property of notifications
        with a state property value of 'emergency'.
      </dd>
    </dl>
  </dd>
</dl>

### Example configuration

I use the plugin's output channel feature to operate an LED indicator
when an alarm notification is present in Signal K and a sounder to
signal when an alarm or emergency state is present.

The configuration I use on my boat uses two relay outputs and a
switch input:

* 'electrical.switches.bank.usb0.1' operates an LED beacon;
* 'electrical.switches.bank.usb0.2' operates an audible sounder;
* 'electrical.switches.bank.0.12.state' senses a momentary panel switch.

I also define two custom notification methods 'push' and 'email' which
I can use to flag notifications that might reasonable be consumed by
a notification forwarder (like
[pdjr-signalk-push-notifications](https://github.com/pdjr-signalk/pdjr-skplugin-push-notifications))
to push notifications from Signal K to remote system users.

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
    ],
    "methods": {
      "customMethods": "push, email",
      "alert": [ "visual" ],
      "warn": [ "visual" ],
      "alarm": [ "visual", "sound", "push", "email" ],
      "emergency": [ "visual", "sound", "push", "email" ]
    }
  }
}
```

## Operating principle

The plugin monitors all selected keys in the Signal K tree which have
an associated metadata object that contains a 'zones' property and
which are therefore able to support alarm function.

The plugin waits for values to appear on each key and checks these
against the associated metadata alarm zones: if the key value falls
within an alarm zone then a notification will be issued on the path
'notifications.*key*' using the rules for state and method settings
defined in the *key*'s metadata zones property and the plugin
defaults. 

Each time a notification is issued the alarm digest and any specified
output channel states are updated.

## Author

Paul Reeve <*preeve_at_pdjr_dot_eu*>
