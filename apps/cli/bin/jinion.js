#!/usr/bin/env node
// React's development build is slower and prints warnings over the full-screen UI.
process.env.NODE_ENV ??= 'production';
await import('../dist/main.js');
