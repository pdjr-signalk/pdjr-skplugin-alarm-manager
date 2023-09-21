import React from 'react';
import { Button, Col, FormGroup } from 'reactstrap';
import Collapsible from 'react-collapsible';
import FormField from './FormField';

class Outputs extends React.Component {

  constructor(props) {
    //console.log("Outputs(%s):\n", JSON.stringify(props));
    super(props);

    this.notificationStates = props.notificationStates || [ 'alert', 'warn', 'alarm', 'emergency' ];
    this.panelStyle = { background: '#f0f0f0', padding: '4px', marginTop: '3px' }

    this.onChangeCallback = props.onChangeCallback;
    this.value = props.value;

    this.createOutput = this.createOutput.bind(this);
    this.deleteOutput = this.deleteOutput.bind(this);
  }

  setName(outputName, name) {
    this.value.forEach(o => { if (o.name === outputName) o.name = name.trim(); });
  }

  setPath(outputName, path) {
    this.value.forEach(o => { if (o.name === outputName) o.path = path.trim(); });
  }

  getTriggerStatesAsOptions(outputName) {
    return(this.value.reduce((a,o) => ((o.name === outputName)?(o.triggerStates.map(s => ({ label: s, value: s }))):a), []));
  }

  setTriggerStatesFromOptions(outputName, options) {
    this.value.forEach(o => { if (o.name === outputName) o.triggerStates = options.map(option => option.value)});
  }

  setSuppressionPath(outputName, path) {
    this.value.forEach(o => { if (o.name === outputName) o.suppressionPath = path.trim(); });
  }

  render() {
    return(
      <FormGroup row>
        <Col>
          <Collapsible trigger={this.props.label + '...'} triggerStyle={{ fontWeight: 'bold' }}>
            <div>
              {
                this.value.map(output => {
                  return(
                      <div style={this.panelStyle}>
                        <FormField
                          type='text'
                          label='Name'
                          labelWidth='3'
                          value={output.name}
                          onChangeCallback={(v) => this.setName(output.name, v)}
                        />
                        <FormField
                          type='text'
                          label='Path'
                          labelWidth='3'
                          value={output.path}
                          onChangeCallback={(v) => this.setPath(output.name, v)}
                        />
                        <FormField
                          type='multiselect'
                          label='Triggers'
                          labelWidth='3'
                          value={this.getTriggerStatesAsOptions(output.name)}
                          options={this.notificationStates.map(s => ({ label: s, value: s }))}
                          onChangeCallback={(options) => this.setTriggerStatesFromOptions(output.name, options)}
                        />
                        <FormField
                          type='text'
                          label='Suppression path'
                          labelWidth='3'
                          value={output.suppressionPath}
                          onChangeCallback={(v) => this.setSuppressionPath(output.name, v)}
                        />
                        <div>
                          <Button onClick={()=>this.deleteOutput(output.name)}>Delete</Button>
                        </div>
                      </div>
                  );
                })
              }
              <div>
                <Button onClick={this.createOutput} style={{ width: '100%' }}>+</Button>
              </div>
            </div>
          </Collapsible>
        </Col>
      </FormGroup>
    );
  }

  createOutput() {
    this.value.push({
      name: "new-output",
      path: "/plugins/alarm-manager/new-output",
      triggerStates: [ ],
      suppressionPath: ""
    })
    this.forceUpdate();
  }

  deleteOutput(name) {
    console.log("deleteOutput(%s)...",name);
    this.value = this.value.filter(o => (o.name !== name));
    this.forceUpdate();
  }
}

export default Outputs;