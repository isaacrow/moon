/// <reference types="vite/client" />

// Figma Make asset imports; vite.config.ts resolves them to a placeholder image locally.
declare module 'figma:asset/*' {
  const src: string;
  export default src;
}

// jsonld ships without type declarations.
declare module 'jsonld';
