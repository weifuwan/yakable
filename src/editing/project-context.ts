/**
 * Project source context assembly is owned by src/context.
 *
 * Editing keeps this narrow facade while downstream capabilities migrate their
 * imports independently; no project-context behavior lives in this module.
 */
export * from '../context/project-context.js';
