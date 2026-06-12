// Canonical implementation lives in shared/playerCountMode.js (zero-host-dependency
// layer, vendored by the wxapp sibling repo). This shim keeps existing src/ imports stable.
export {
  normalizePlayerCountMode,
  resolvePlayerCountMode,
  resolveInitialPlayerCountMode
} from '../../shared/playerCountMode.js';
