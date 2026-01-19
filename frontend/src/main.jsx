import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { KanbanProvider } from './contexts';
import App from './pages/App';
import './styles/index.css';

// Import the API service to ensure it's initialized
import './services/api';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <KanbanProvider>
        <App />
      </KanbanProvider>
    </BrowserRouter>
  </React.StrictMode>
);
