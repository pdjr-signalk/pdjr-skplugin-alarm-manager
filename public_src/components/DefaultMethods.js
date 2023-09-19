import React from 'react';
import { Col, FormGroup, Label } from 'reactstrap';
import Collapsible from 'react-collapsible';
import FormField from './FormField';

class DefaultMethods extends React.Component {

  constructor(props) {
    console.log("DefaultMethods(%s)...", JSON.stringify(props));
    super(props);

    this.options = [ { label: 'visual', value: 'visual'}, { label: 'sound', value: 'sound' }];
    this.label = props.label;
    this.labelWidth = props.labelWidth;
    this.label_style = { lineHeight: '10px' };
    this.onChangeCallback = props.onChangeCallback;
    this.value = props.value;
  }

  render() {
    this.contentStyle = { background: '#f0f0f0', padding: '4px' };
    return(
      <FormGroup row>
        <Col>
          <Collapsible trigger={this.label} triggerWhenOpen={this.label} triggerStyle={{ fontWeight: 'bold' }}>
            <div style={this.contentStyle}>
              <FormField
                type='multiselect'
                name='alertMethod'
                label='Alert'
                labelWidth='3'
                value={this.value.alertMethod.map(v => ({ label: v, value: v }))}
                options={this.options}
                onChangeCallback={(v)=>this.onChangeCallback('alertMethod', v)}
              />
              <FormField
                type='multiselect'
                name='warnMethod'
                label='Warn'
                labelWidth='3'
                value={this.value.warnMethod.map(v => ({ label: v, value: v }))}
                options={this.options}
                onChangeCallback={(v)=>this.onChangeCallback('warnMethod', v)}
              />
              <FormField
                type='multiselect'
                name='alarmMethod'
                label='Alarm'
                labelWidth='3'
                value={this.value.alarmMethod.map(v => ({ label: v, value: v }))}
                options={this.options}
                onChangeCallback={(v)=>this.onChangeCallback('alarmMethod', v)}
              />
              <FormField
                type='multiselect'
                name='emergencyMethod'
                label='Emergency'
                labelWidth='3'
                value={this.value.emergencyMethod.map(v => ({ label: v, value: v }))}
                options={this.options}
                onChangeCallback={(v)=>this.onChangeCallback('emergencyMethod', v)}
              />
            </div>
          </Collapsible>
        </Col>
      </FormGroup>
    );
  }

  onChangeCallback(name, value) {
    this.value[name] = value.map(v => v.value);
    this.onChangeCallback(this.value);
  }

}

export default DefaultMethods;