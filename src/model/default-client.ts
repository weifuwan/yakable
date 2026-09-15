import { deepSeekModelClient } from './deepseek.js';

/**
 * Process-level default provider used by standalone domain APIs/CLIs.
 * AgentRuntime passes its own ModelClient explicitly and never relies on this fallback.
 */
export const defaultModelClient = deepSeekModelClient;
