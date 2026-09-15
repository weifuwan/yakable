/**
 * Project source context selection is owned by src/context.
 *
 * Editing keeps this narrow facade while downstream capabilities migrate their
 * imports independently; no context-selection behavior lives in this module.
 */
export * from '../context/project-context-selection.js';
