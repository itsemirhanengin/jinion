import './app/app.css';
import { followScrollbars } from '@jinion/ui';
import { Provider } from 'jotai';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/app.js';
import './state/accent.js';
import { appStore } from './state/app.js';

// The window takes macOS's appearance, and changes with it.
const dark = matchMedia('(prefers-color-scheme: dark)');
const follow = () => document.documentElement.classList.toggle('dark', dark.matches);

follow();
dark.addEventListener('change', follow);
followScrollbars();

// A file dropped beside the composer would open in the window in its place: the packaged page and the file are both
// file:// URLs, which the main process's guard against leaving the app lets through.
for (const type of ['dragover', 'drop']) addEventListener(type, (event) => event.preventDefault());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={appStore}>
      <App />
    </Provider>
  </StrictMode>,
);
