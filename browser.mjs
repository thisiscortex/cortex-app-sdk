/**
 * Browser-side Cortex capabilities. The preload owns app identity and
 * permissions; page JavaScript only receives the methods already granted to
 * its BrowserWindow.
 */
export function connectHost() {
  const bridge = globalThis.cortexAppHost;
  if (!bridge || typeof bridge !== 'object') return null;
  return {
    dialogs: {
      pickDirectory: (options = {}) => bridge.dialogs.pickDirectory(options),
    },
  };
}

export default { connectHost };
