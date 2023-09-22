import React from 'react';
import { Col, FormGroup } from 'reactstrap';
import Collapsible from 'react-collapsible';
import FormField from './FormField';

export default function DefaultMethods({
  labelWidth='3',
  collapsibleTriggerStyle={},
  collapsiblePanelStyle={},
  collapsibleLabel='Default methods',
  methodOptions=[],
  methods,
  onChangeCallback
}) {
  console.log("DefaultMethods: %s", JSON.stringify(methods));
  return(
    <FormGroup row>
      <Col>
        <Collapsible trigger={collapsibleLabel + "..."} collapsibleTriggerStyle={collapsibleTriggerStyle}>
          <div style={collapsiblePanelStyle}>
            <FormField
              type='multiselect'
              name='alertMethod'
              label='Alert'
              labelWidth={labelWidth}
              value={methods.alert.map(v => ({ label: v, value: v }))}
              options={methodOptions}
              onChangeCallback={(options) => onChangeCallback('alert', options)}
            />
            <FormField
              type='multiselect'
              name='warnMethod'
              label='Warn'
              labelWidth={labelWidth}
              value={methods.warn.map(v => ({ label: v, value: v }))}
              options={methodOptions}
              onChangeCallback={(options) => onChangeCallback('warn', options)}
            />
            <FormField
              type='multiselect'
              name='alarmMethod'
              label='Alarm'
              labelWidth={labelWidth}
              value={methods.alarm.map(v => ({ label: v, value: v }))}
              options={methodOptions}
              onChangeCallback={(options) => onChangeCallback('alarm', options)}
            />
            <FormField
              type='multiselect'
              name='emergencyMethod'
              label='Emergency'
              labelWidth={labelWidth}
              value={methods.emergency.map(v => ({ label: v, value: v }))}
              options={methodOptions}
              onChangeCallback={(options) => onChangeCallback('emergency', options)}
            />
          </div>
        </Collapsible>
      </Col>
    </FormGroup>
  )
}
