// Stylesheets are side-effect imports with no JS surface; this teaches the compiler
// what the bundler already knows.
declare module '*.css';
