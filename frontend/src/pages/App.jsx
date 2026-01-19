import React, { useEffect } from 'react';
import { tasksAPI } from '../services/api';
import { useKanban } from '../contexts';
import { Box, CircularProgress, Typography, Container } from '@mui/material';
import { Layout, Header } from '../components';

function App() {
  const { state, dispatch } = useKanban();
  const { isLoading, error } = state;

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const data = await tasksAPI.getAllTasks();
        dispatch({ type: 'SET_TASKS', payload: data });
        dispatch({ type: 'SET_LOADING', payload: false });
      } catch (err) {
        dispatch({ type: 'SET_ERROR', payload: err.message });
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    fetchTasks();
  }, [dispatch]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  return (
    <Layout>
      <Header />
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            YoursKanban
          </Typography>
          {/* Kanban board content will go here */}
          <pre>{JSON.stringify(state.tasks, null, 2)}</pre>
        </Box>
      </Container>
    </Layout>
  );
}

export default App;
