import React, { useState, useEffect } from 'react';
import { tasksAPI } from './api';

function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const data = await tasksAPI.getAllTasks();
        setTasks(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="app">
      <header>
        <h1>YoursKanban</h1>
      </header>
      <main>
        {/* Kanban board will be rendered here */}
        <pre>{JSON.stringify(tasks, null, 2)}</pre>
      </main>
    </div>
  );
}

export default App;
