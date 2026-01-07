

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

console.log('Starting React application rendering...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Hide the HTML loading spinner once React successfully finds the root element
const htmlSpinner = document.getElementById('html-loading-spinner');
if (htmlSpinner) {
  htmlSpinner.style.display = 'none';
  console.log('HTML loading spinner hidden by index.tsx.');
}

console.log('React app is mounting to the DOM...');
const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);