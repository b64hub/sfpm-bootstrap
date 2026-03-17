import { defineConfig } from '@b64/sfpm-core';
import { defineOrgConfig } from '@b64/sfpm-orgs';
import { profileHooks } from '@b64/sfpm-hooks';

export default defineConfig({
  npmScope: '@b64hub',
  hooks: [
    profileHooks({
        scope: 'org',
        removeLoginIpRanges: true,
    })
  ],
  orgs: defineOrgConfig({
    scratchOrg: { 
      definitionFile: 'config/project-scratch-def.json' 
    },
  }),
});