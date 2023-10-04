import React, { useState, useRef } from 'react';
import { Col, Form, FormGroup, ButtonToolbar, Button } from 'reactstrap';
import FormField from './FormField';
import DefaultMethods from './DefaultMethods';
import Outputs from './Outputs';

const collapsibleTriggerStyle = { }
const collapsiblePanelStyle = { background: '#f0f0f0', padding: '4px', marginTop: '3px' };
const panelStyle = { background: '#e0e0e0', padding: '4px', marginBottom: '3px' };
const defaultNotificationMethods = [ 'visual', 'sound' ];
const labelWidth = '3';


class PluginConfigurator extends React.Component {

  constructor(props) {
    //console.log("PluginConfigurator:\n", JSON.stringify(props, null, 2));
    super(props);

    this.state = {
      saveButtonDisabled: true,
      cancelButtonDisabled: true,
      subscribeButtonDisabled: true,
      unsubscribeButtonDisabled: true,
      ignorePaths: props.configuration.ignorePaths,
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
    this.setState({ ignorePaths: text.split(',').map(v => v.trim()).sort(), saveButtonDisabled: false, cancelButtonDisabled: false });
  }

  setDigestPath(text) {
    this.setState({ digestPath: text.trim(), saveButtonDisabled: false, cancelButtonDisabled: false });
  }

  updateOutput(name, property, value) {
    var newOutputs = [];
    this.state.outputs.forEach(output => {
      if (output.name === name) {
        switch (property) {
          case 'name': newOutputs.push({ name: value, path: output.path, methods: output.methods, suppressionPath: output.suppressionPath }); break;
          case 'path': newOutputs.push({ name: output.name, path: value , methods: output.methods, suppressionPath: output.suppressionPath }); break;
          case 'methods': newOutputs.push({ name: output.name, path: output.path, methods: value, suppressionPath: output.suppressionPath }); break;
          case 'suppressionPath': newOutputs.push({ name: output.name, path: output.path, methods: output.methods, suppressionPath: value }); break;
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
          methods: [],
          suppressionPath: ""
        });
        break;  
      }
    };
    this.setState({ outputs: newOutputs, saveButtonDisabled: false, cancelButtonDisabled: false });
  }

  setDefaultMethods(method, methods) {
    var newDefaultMethods = {};
    switch (method) {
      case 'customMethods':
        newDefaultMethods['customMethods'] = methods.split(',').map(v => v.trim()).sort().join(', ');
      default:
        Object.keys(this.state.defaultMethods).forEach(key => {
          newDefaultMethods[key] = (key === method)?methods:this.state.defaultMethods[key];
        });
        break;
      }
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
              labelWidth={labelWidth}
              value={this.state.ignorePaths.join(', ')}
              rows='2'
              wrap='on'
              style={{ width: '100%' }}
              onChangeCallback={this.setIgnorePaths}
            />
            <FormField
              type='text'
              name='digestPath'
              label='Digest path'
              labelWidth={labelWidth}
              value={this.state.digestPath}
              text=''
              onChangeCallback={this.setDigestPath}
            />
            <Outputs
              labelWidth={labelWidth}
              collapsibleTriggerStyle={collapsibleTriggerStyle}
              collapsiblePanelStyle={collapsiblePanelStyle}
              collapsibleLabel='Outputs'
              panelStyle={panelStyle}
              defaultNotificationMethods={defaultNotificationMethods}
              outputs={this.state.outputs}
              onChangeCallback={this.updateOutput}
              onDeleteCallback={this.deleteOutput}
              onCreateCallback={this.createOutput}
              />
            <DefaultMethods
              labelWidth={labelWidth}
              collapsibleLabel='Methods'
              collapsibleTriggerStyle={collapsibleTriggerStyle}
              collapsiblePanelStyle={collapsiblePanelStyle}
              notificationMethods={defaultNotificationMethods.concat(this.state.defaultMethods.customMethods.split(',').map(v => v.trim()))}
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
      outputs: this.stateOutputs,
      defaultMethods: this.state.defaultMethods
    });
  }

  onCancel() {
    //console.log("onCancel:\n%s", JSON.stringify(this.options, null, 2));
    this.setState({ saveButtonDisabled: true, cancelButtonDisabled: true });
    this.setState({ ignorePaths: this.props.configuration.ignorePaths.join(', ') });
    this.setState({ digestPath: this.props.configuration.digestPath });
    this.setState({ outputs: this.props.configuration.outputs }),
    this.setState({ defaultMethods: this.props.configuration.defaultMethods })
  }  

}

export default PluginConfigurator;