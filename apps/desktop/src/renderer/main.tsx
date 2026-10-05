import './app/app.css';
import { Provider } from 'jotai';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/app.js';
import { appStore } from './state/app.js';

// The window takes macOS's appearance, and changes with it.
const dark = matchMedia('(prefers-color-scheme: dark)');
const follow = () => document.documentElement.classList.toggle('dark', dark.matches);

follow();
dark.addEventListener('change', follow);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={appStore}>
      <App />
    </Provider>
  </StrictMode>,
);
