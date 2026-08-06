import '@kajay/themes/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.js';
import './styles.css';

const container = document.querySelector('#root');
if (container === null) throw new Error('The demo root element is missing.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
