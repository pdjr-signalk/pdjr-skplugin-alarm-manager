import React, { useState, useRef } from 'react';
import { Col, Form, FormGroup, ButtonToolbar, Button } from 'reactstrap';
import FormField from './FormField';
import DefaultMethods from './DefaultMethods';
import Outputs from './Outputs';

class PluginConfigurator extends React.Component {

  constructor(props) {
    //console.log("PluginConfigurator:\n", JSON.stringify(props, null, 2));
    super(props);

    this.state = {
      saveButtonDisabled: true,
      cancelButtonDisabled: true,
      digestPath: _.cloneDeep(this.props.configuration.digestPath)
    }

    this.options = _.cloneDeep(this.props.configuration);
  }

  setIgnorePaths(text) {
    this.options.ignorePaths = text.split(',').map(path => path.trim());
    this.setState({ saveButtonDisabled: false, cancelButtonDisabled: false });
  }

  setDigestPath(text) {
    this.setState({ digestPath: text.trim() });
    this.setState({ saveButtonDisabled: false, cancelButtonDisabled: false });
  }

  setOutputs(outputs) {
    this.options.outputs = outputs;
    this.setState({ saveButtonDisabled: false, cancelButtonDisabled: false });
  }

  setDefaultMethods(defaultMethods) {
    this.options.defaultMethods = defaultMethods;
    this.setState({ saveButtonDisabled: false, cancelButtonDisabled: false });
  }

  render() {
    return(
      <Form className='square rounded border' style={{ padding: '5px' }}>
        <FormGroup row /*style={{ height: '300px' }}*/>
          <Col>
            <FormField type='textarea' name='ignorePaths' label='Ignore paths' labelWidth='3' value={this.options.ignorePaths.join(', ')} rows='2' wrap='on' style={{ width: '100%' }} onChangeCallback={(v) => this.setIgnorePaths(v)} />
            <FormField type='text' name='digestPath' label='Digest path' labelWidth='3' value={this.state.digestPath} text='' onChangeCallback={(v) => this.setDigestPath(v)} />
            <Outputs value={this.options.outputs} label='Outputs' labelWidth='3' onChangeCallback={(v) => this.setOutputs(v)} />
            <DefaultMethods value={this.options.defaultMethods} label='Default methods' labelWidth='3' onChangeCallback={(v) => this.setDefaultMethods(v)} />
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
    this.save(this.options);
  }

  onCancel() {
    //console.log("onCancel:\n%s", JSON.stringify(this.options, null, 2));
    this.setState({ saveButtonDisabled: true, cancelButtonDisabled: true });
    this.forceUpdate();
    this.setState({ digestPath: _.cloneDeep(this.props.configuration.digestPath) });
    this.forceUpdate();
  }

}

export default PluginConfigurator;
  