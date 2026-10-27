// NEVER import this file from inside src -> leads to a circular dependency on the 'dist' output -> larger output every build
export * from './src/index.js';
