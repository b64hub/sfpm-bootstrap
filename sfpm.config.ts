import { defineConfig } from '@b64/sfpm-core';
import { lwcTypescriptHooks } from '@b64/sfpm-hooks'

export default defineConfig({
  sourceApiVersion: '65.0',
  hooks: [lwcTypescriptHooks()]
});