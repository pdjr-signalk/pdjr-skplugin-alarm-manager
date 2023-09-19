import React from 'react';
import { Button, Col, FormGroup } from 'reactstrap';
import Collapsible from 'react-collapsible';
import FormField from './FormField';

class Outputs extends React.Component {

  constructor(props) {
    console.log("Outputs(%s):\n", JSON.stringify(props));
    super(props);

    this.options = [
      { label: 'alert', value: 'alert' },
      { label: 'warn', value: 'warn' },
      { label: 'alarm', value: 'alarm' },
      { label: 'emergency', value: 'emergency' }
    ];
    this.label = props.label;
    this.labelWidth = props.labelWidth;
    this.label_style = { lineHeight: '10px' };
    this.onChangeCallback = props.onChangeCallback;
    this.value = props.value;

    this.createOutput = this.createOutput.bind(this);
    this.deleteOutput = this.deleteOutput.bind(this);
  }

  render() {
    var componentWidth = Math.round(((12 - this.labelWidth) / 12) * 100);
    var contentStyle = { };
    var outputContentStyle = { background: '#f0f0f0', padding: '4px', marginTop: '3px' }

    return(
      <FormGroup row>
        <Col>
          <Collapsible trigger={this.label} triggerStyle={{ fontWeight: 'bold' }}>
            <div style={contentStyle}>
              {
                this.value.map(output => {
                  return(
                      <div style={outputContentStyle}>
                        <FormField
                          type='text'
                          label='Name'
                          labelWidth='3'
                          value={output.name}
                          onChangeCallback={(v)=>this.onChangeName(output.name, v)}
                        />
                        <FormField
                          type='text'
                          label='Path'
                          labelWidth='3'
                          value={output.path}
                          onChangeCallback={(v)=>this.onChangePath(output.name, v)}
                        />
                        <FormField
                          type='multiselect'
                          label='Triggers'
                          labelWidth='3'
                          value={output.triggerStates.map(v=>({ label: v, value: v }))}
                          options={this.options}
                          onChangeCallback={(v)=>this.onChangeTriggerStates(output.name, v)}
                        />
                        <div>
                          <Button onClick={()=>this.deleteOutput(output.name)}>Delete</Button>
                        </div>
                      </div>
                  );
                })
              }
              <div style={outputContentStyle}>
                <Button onClick={this.createOutput} style={{ width: '100%' }}>+</Button>
              </div>
            </div>
          </Collapsible>
        </Col>
      </FormGroup>
    );
  }

  onChangeName(name, value) {
    //this.value[name] = value.map(v => v.value);
    //this.onChangeCallback(this.value);
  }

  onChangePath(name, value) {
    //this.value[name] = value.map(v => v.value);
    //this.onChangeCallback(this.value);
  }

  onChangeTriggerStates(name, value) {
    
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