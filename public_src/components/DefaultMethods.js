import React from 'react';
import { Col, FormGroup, Label } from 'reactstrap';
import Collapsible from 'react-collapsible';
import FormField from './FormField';

class DefaultMethods extends React.Component {

  constructor(props) {
    //console.log("DefaultMethods(%s)...", JSON.stringify(props));
    super(props);

    this.methodOptions = props.methodOptions || [ { label: 'visual', value: 'visual'}, { label: 'sound', value: 'sound' }];

    this.onChangeCallback = props.onChangeCallback;
    this.value = props.value;
  }

  getMethodAsOption(name) {
    return(this.value[name].map(v => ({ label: v, value: v })));
  }

  setMethodFromOptions(name, options) {
    this.value[name] = options.map(option => option.value);
    this.onChangeCallback(this.value);
  }

  render() {
    this.contentStyle = { background: '#f0f0f0', padding: '4px' };
    return(
      <FormGroup row>
        <Col>
          <Collapsible trigger={this.props.label + '...'} triggerStyle={{ fontWeight: 'bold' }}>
            <div style={this.contentStyle}>
              <FormField
                type='multiselect'
                name='alertMethod'
                label='Alert'
                labelWidth='3'
                value={this.getMethodAsOption('alertMethod')}
                options={this.methodOptions}
                onChangeCallback={(options) => this.setMethodFromOptions('alertMethod', options)}
              />
              <FormField
                type='multiselect'
                name='warnMethod'
                label='Warn'
                labelWidth='3'
                value={this.getMethodAsOption('warnMethod')}
                options={this.methodOptions}
                onChangeCallback={(options) => this.setMethodFromOptions('warnMethod', options)}
              />
              <FormField
                type='multiselect'
                name='alarmMethod'
                label='Alarm'
                labelWidth='3'
                value={this.getMethodAsOption('alarmMethod')}
                options={this.methodOptions}
                onChangeCallback={(options) => this.setMethodFromOptions('alarmMethod', options)}
              />
              <FormField
                type='multiselect'
                name='emergencyMethod'
                label='Emergency'
                labelWidth='3'
                value={this.getMethodAsOption('emergencyMethod')}
                options={this.methodOptions}
                onChangeCallback={(options) => this.setMethodFromOptions('emergencyMethod', options)}
              />
            </div>
          </Collapsible>
        </Col>
      </FormGroup>
    );
  }

}

export default DefaultMethods;