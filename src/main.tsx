import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept and gracefully ignore third-party script errors (e.g., from Gaode AMap inside the sandboxed iframe)
// to prevent them from bubbling up as unhandled "Script error." which breaks the app container.
if (typeof window !== 'undefined') {
  window.onerror = function (message, source, lineno, colno, error) {
    const msg = String(message).toLowerCase();
    const srcStr = source ? String(source).toLowerCase() : '';
    const errStack = error && error.stack ? String(error.stack).toLowerCase() : '';
    
    if (
      msg.includes('script error') || 
      srcStr.includes('amap') || 
      srcStr.includes('webapi') ||
      errStack.includes('amap')
    ) {
      console.warn('Swallowed cross-origin or third-party script error safely:', message, 'Source:', source);
      return true; // Prevents the firing of the default event handler and stops bubbling
    }
    return false;
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason) {
      const reasonStr = String(reason).toLowerCase();
      const reasonStack = reason.stack ? String(reason.stack).toLowerCase() : '';
      if (
        reasonStr.includes('amap') || 
        reasonStr.includes('script error') || 
        reasonStack.includes('amap')
      ) {
        console.warn('Swallowed unhandled promise rejection from third-party map API safely:', reason);
        event.preventDefault();
        event.stopPropagation();
      }
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

