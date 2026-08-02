// The host imports the stylesheet itself; no @kajay package pulls CSS in for it
// (ADR-0010). Both of these resolve through published `exports` subpaths.
import '@kajay/themes/styles.css';
import '@kajay/themes/themes/dark.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './host-demo.css';

const container = document.querySelector('#root');
if (container === null) {
  throw new Error('Host demo could not find its #root container.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
