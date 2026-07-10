import { Alert } from '@mui/material';
import { Component } from 'react';

export default class DiagramErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previousProps) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) {
      return <Alert severity="error">This diagram could not be rendered. The article content is still available in the Article tab.</Alert>;
    }
    return this.props.children;
  }
}
