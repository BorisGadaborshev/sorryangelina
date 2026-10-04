import React from 'react';
import { Box, Button, Typography } from '@mui/material';

interface Props {
  children: React.ReactNode;
  title?: string;
}

interface State {
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {this.props.title || 'Этот блок не удалось показать'}
        </Typography>
        <Button size="small" variant="outlined" onClick={this.reset}>
          Перезагрузить блок
        </Button>
      </Box>
    );
  }
}

export default ErrorBoundary;
