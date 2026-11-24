import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { DEFAULT_SETTINGS } from './utils/helpers';

if (typeof window !== 'undefined') {
  window.settings = window.settings || DEFAULT_SETTINGS;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
