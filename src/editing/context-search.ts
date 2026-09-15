/**
 * Project source context search is owned by src/context.
 *
 * Editing keeps this narrow facade while downstream capabilities migrate their
 * imports independently; no context-search behavior lives in this module.
 */
export * from '../context/project-context-search.js';
