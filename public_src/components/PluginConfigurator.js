import React, { useState, useRef } from 'react';
import { Col, Form, FormGroup, ButtonToolbar, Button } from 'reactstrap';
import FormField from './FormField';
import DefaultMethods from './DefaultMethods';
import Outputs from './Outputs';

class PluginConfigurator extends React.Component {

  constructor(props) {
    console.log("PluginConfigurator:\n", JSON.stringify(props, null, 2));
    super(props);

    this.ignorePaths = props.configuration.ignorePaths;
    this.digestPath = props.configuration.digestPath;
    this.outputs = props.configuration.outputs;
    this.defaultMethods = props.configuration.defaultMethods;
  }

  render() {
    return(
      <Form className='square rounded border' style={{ padding: '5px' }}>
        <FormGroup row /*style={{ height: '300px' }}*/>
          <Col>
            <FormField type='textarea' name='ignorePaths' label='Ignore paths' labelWidth='3' value={this.ignorePaths.join(', ')} rows='2' wrap='on' style={{ width: '100%' }} onChangeCallback={(v) => { this.ignorePaths = v.split(',').map(v=>v.trim()) }} />
            <FormField type='text' name='digestPath' label='Digest path' labelWidth='3' value={this.digestPath} text='' onChangeCallback={(v) => { this.digestPath = v }} />
            <Outputs value={this.outputs} label='Outputs' labelWidth='3' onChangeCallback={(v) => { this.outputs = v; }} />
            <DefaultMethods value={this.defaultMethods} label='Default methods' labelWidth='3' onChangeCallback={(v) => { this.defaultMethods = v; }} />
          </Col>
        </FormGroup>
        <FormGroup row>
          <Col>
            <ButtonToolbar style={{ justifyContent: 'space-between' }}>
              <ButtonToolbar>
                <Button size='sm' color='primary' onClick={(e) => { e.preventDefault(); this.onSubmit(); }}><i className='fa fa-save' /> Save </Button>&nbsp;
                <Button size='sm' color='primary' onClick={(e) => { e.preventDefault(); this.onCancel(); }}><i className='fa fa-ban' /> Cancel </Button>
              </ButtonToolbar>
              <ButtonToolbar>
                <Button size='sm' color='danger' onClick={(e) => { e.preventDefault(); this.onCompose(); }}><i className='fa fa-save' /> Subscribe </Button>&nbsp;
              </ButtonToolbar>
            </ButtonToolbar>
          </Col>
        </FormGroup>
      </Form>
    )
  }

  onChangeIgnorePaths(s) { this.setState({ ignorePaths: s }); }
  onChangeDigestPath(s) { this.setState({ digestPath: s }); }
  onChangeOutputs(n) { }
  onChangeDefaultMethods(n, v) {
    var nv = Object.keys(this.state.defaultMethods).reduce((a,k) => {
      a[k] = (k === n)?v:this.state.defaultMethods[k];
    }, {});
  }
  
  /** BUTTON HANDLERS ************************************************/ 

  onSubmit() {
    this.save({
      ignorePaths: this.state.ignorePaths.split(',').map(v => v.trim()),
      digestPath: this.state.digestPath,
      outputs: outputs,
      defaultMethods: Object.keys(this.state.defaultMethods).reduce((a,k) => {
        a[k] = this.state.defaultMethods[k].map(v => (v.value));
      }, {})
    });
  }

  onCancel() {
    this.save(this.props.configuration);
  }
  
  onSubscribe() {
  }

}

export default PluginConfigurator;
  