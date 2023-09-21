import React from 'react';
import { Col, FormGroup, FormText, Label, Input } from 'reactstrap';
import Select from 'react-select';

class FormField extends React.Component {

  constructor(props) {
    //console.log("FormField:\n", JSON.stringify(props, null, 2));
    super(props);

    this.type = props.type || 'text'
    this.name = props.name;
    this.state = {
      value: props.value
    };
    this.label = props.label;
    this.radios = props.radios;
    this.text = props.text;
    this.labelWidth = props.labelWidth;
    this.wrap = props.wrap || 'off';
    this.options = props.options;
    this.rows = props.rows || '12'
    this.label_style = { lineHeight: '36px' };
    this.onChangeCallback = props.onChangeCallback;
  }

  render() {
    var labelWidth = (this.label)?((this.labelWidth)?this.labelWidth:6):0;
    var componentWidth = (this.label)?(12 - labelWidth):12;
    return(
      <FormGroup row>
        {
          (this.label)
          ? <Col md={labelWidth}><Label style={this.label_style} htmlFor={this.name}>{this.label}</Label></Col>
          : ''
        }
        <Col md={componentWidth}>
          {
            (this.type == 'checkbox')
            ? <Input type='checkbox' name={this.name} onChange={(e)=>this.state.onChangeCallback(e.target.value)} checked={this.value} />
            : ''
          }
          {
            (this.type == 'multiselect')
            ? <Select name={this.name} options={this.options} value={this.state.value} isMulti className="basic-multi-select" classNamePrefix="select" onChange={(v)=>{ this.setState({ value: v }); this.onChangeCallback(v); }} />
            : ''
          }
          {
            (this.type == 'text')
            ? <Input type='text' name={this.name} value={this.state.value} onChange={(e)=>{ this.setState({ value: e.target.value.trim() }); this.onChangeCallback(this.state.value)}} />
            : ''
          }
          {
            (this.type == 'textarea')
            ? <textarea name={this.name} rows={this.rows} wrap={this.wrap} style={{ width: '100%' }} value={this.state.value} onChange={(e)=>{ this.setState({ value: e.target.value.trim() }); this.onChangeCallback(this.state.value)}} />
            : ''
          }
          {
            (this.text)
            ? <FormText color='muted'>{this.text}</FormText>
            : ''
          }
        </Col>
      </FormGroup>
    )
  }

}

export default FormField;