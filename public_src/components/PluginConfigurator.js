import React, { useState, useRef } from 'react';
import { Col, Form, FormGroup, ButtonToolbar, Button } from 'reactstrap';
import FormField from './FormField';
import DefaultMethods from './DefaultMethods';
import Outputs from './Outputs';

const collapsibleTriggerStyle = { }
const collapsiblePanelStyle = { background: '#f0f0f0', padding: '4px', marginTop: '3px' };
const panelStyle = { background: '#e0e0e0', padding: '4px', marginBottom: '3px' };
const methodOptions = [ { label: 'visual', value: 'visual'}, { label: 'sound', value: 'sound' }];
const notificationStates = [ 'alert', 'warn', 'alarm', 'emergency' ];


class PluginConfigurator extends React.Component {

  constructor(props) {
    //console.log("PluginConfigurator:\n", JSON.stringify(props, null, 2));
    super(props);

    this.state = {
      saveButtonDisabled: true,
      cancelButtonDisabled: true,
      ignorePaths: props.configuration.ignorePaths.join(','),
      digestPath: props.configuration.digestPath,
      outputs: props.configuration.outputs,
      defaultMethods: props.configuration.defaultMethods
    }

    this.options = _.cloneDeep(this.props.configuration);
    this.setIgnorePaths = this.setIgnorePaths.bind(this);
    this.setDigestPath = this.setDigestPath.bind(this);
    this.updateOutput = this.updateOutput.bind(this);
    this.deleteOutput = this.deleteOutput.bind(this);
    this.createOutput = this.createOutput.bind(this);
    this.setDefaultMethods = this.setDefaultMethods.bind(this);
  }

  setIgnorePaths(text) {
    this.setState({ ignorePaths: text.trim(), saveButtonDisabled: false, cancelButtonDisabled: false });
  }

  setDigestPath(text) {
    this.setState({ digestPath: text.trim(), saveButtonDisabled: false, cancelButtonDisabled: false });
  }

  updateOutput(name, property, value) {
    var newOutputs = [];
    this.state.outputs.forEach(output => {
      if (output.name === name) {
        switch (property) {
          case 'name': newOutputs.push({ name: value, path: output.path, triggerStates: output.triggerStates, suppressionPath: output.suppressionPath }); break;
          case 'path': newOutputs.push({ name: output.name, path: value , triggerStates: output.triggerStates, suppressionPath: output.suppressionPath }); break;
          case 'triggerStates': newOutputs.push({ name: output.name, path: output.path, triggerStates: value, suppressionPath: output.suppressionPath }); break;
          case 'suppressionPath': newOutputs.push({ name: output.name, path: output.path, triggerStates: output.triggerStates, suppressionPath: value }); break;
        }
      } else {
        newOutputs.push(output);
      }
    });
    this.setState({ outputs: newOutputs, saveButtonDisabled: false, cancelButtonDisabled: false });
  }

  deleteOutput(name) {
    var newOutputs = [];
    this.state.outputs.forEach(output => { if (output.name !== name) newOutputs.push(output); });
    this.setState({ outputs: newOutputs, saveButtonDisabled: false, cancelButtonDisabled: false });
  }

  createOutput() {
    var newOutputs = _.cloneDeep(this.state.outputs);
    var newNames = [ 'new-output1', 'new-output2', 'new-output3', 'new-output4' ];
    
    for (var i = 0; i < newNames.length; i++) {
      if (!(newOutputs.map(o => o.name)).includes(newNames[i])) {
        newOutputs.push({
          name: newNames[i],
          path: "notifications.plugins.alarm-manager." + newNames[i],
          triggerStates: [],
          suppressionPath: ""
        });
        break;  
      }
    };
    this.setState({ outputs: newOutputs, saveButtonDisabled: false, cancelButtonDisabled: false });
  }

  setDefaultMethods(method, methods) {
    var newDefaultMethods = {};
    Object.keys(this.state.defaultMethods).forEach(key => {
      newDefaultMethods[key] = (key === method)?methods:this.state.defaultMethods[key];
    });
    this.setState({ defaultMethods: newDefaultMethods, saveButtonDisabled: false, cancelButtonDisabled: false });
  }

  render() {
    return(
      <Form className='square rounded border' style={{ padding: '5px' }}>
        <FormGroup row /*style={{ height: '300px' }}*/>
          <Col>
            <FormField
              type='textarea'
              name='ignorePaths'
              label='Ignore paths'
              labelWidth='3'
              value={this.state.ignorePaths}
              rows='2'
              wrap='on'
              style={{ width: '100%' }}
              onChangeCallback={this.setIgnorePaths}
            />
            <FormField
              type='text'
              name='digestPath'
              label='Digest path'
              labelWidth='3'
              value={this.state.digestPath}
              text=''
              onChangeCallback={this.setDigestPath}
            />
            <Outputs
              labelWidth='3'
              collapsibleTriggerStyle={collapsibleTriggerStyle}
              collapsiblePanelStyle={collapsiblePanelStyle}
              collapsibleLabel='Outputs'
              panelStyle={panelStyle}
              notificationStates={notificationStates}
              outputs={this.state.outputs}
              onChangeCallback={this.updateOutput}
              onDeleteCallback={this.deleteOutput}
              onCreateCallback={this.createOutput}
              />
            <DefaultMethods
              labelWidth='3'
              collapsibleLabel='Default methods'
              collapsibleTriggerStyle={collapsibleTriggerStyle}
              collapsiblePanelStyle={collapsiblePanelStyle}
              methodOptions={methodOptions}
              methods={this.state.defaultMethods}
              onChangeCallback={this.setDefaultMethods}
            />
          </Col>
        </FormGroup>
        <FormGroup row>
          <Col>
            <ButtonToolbar style={{ justifyContent: 'space-between' }}>
              <ButtonToolbar>
                <Button size='sm' color='primary' disabled={this.state.saveButtonDisabled} onClick={(e) => { e.preventDefault(); this.onSubmit(); }}><i className='fa fa-save' /> Save </Button>&nbsp;
                <Button size='sm' color='primary' disabled={this.state.cancelButtonDisabled} onClick={(e) => { e.preventDefault(); this.onCancel(); }}><i className='fa fa-ban' /> Cancel </Button>
              </ButtonToolbar>
              <ButtonToolbar>
              </ButtonToolbar>
            </ButtonToolbar>
          </Col>
        </FormGroup>
      </Form>
    )
  }
  
  /** BUTTON HANDLERS ************************************************/ 

  onSubmit() {
    //console.log("onSubmit:\n%s", JSON.stringify(this.options, null, 2));
    this.setState({ saveButtonDisabled: true, cancelButtonDisabled: true });
    this.save({
      ignorePaths: this.state.ignorePaths.split(',').map(v => v.trim()),
      digestPath: this.state.digestPath,
      defaultMethods: {
        alert: this.state.alertMethods.map(v => v.value),
        warn: this.state.warnMethods.map(v => v.value),
        alarm: this.state.alarmMethods.map(v => v.value),
        emergency: this.state.emergencyMethods.map(v => v.value)
      }
    });
  }

  onCancel() {
    //console.log("onCancel:\n%s", JSON.stringify(this.options, null, 2));
    this.setState({ saveButtonDisabled: true, cancelButtonDisabled: true });
    this.setState({ ignorePaths: this.props.configuration.ignorePaths });
    this.setState({ digestPath: this.props.configuration.digestPath });
    this.setState({ defaultAlertMethods: props.configuration.defaultMethods.alert.map(v => ({ label: v, value: v })) }),
    this.setState({ defaultWarnMethods: props.configuration.defaultMethods.warn.map(v => ({ label: v, value: v })) }),
    this.setState({ defaultAlarmMethods: props.configuration.defaultMethods.alarm.map(v => ({ label: v, value: v })) }),
    this.setState({ defaultEmergencyMethods: props.configuration.defaultMethods.emergency.map(v => ({ label: v, value: v })) })
  }

}

export default PluginConfigurator;
  