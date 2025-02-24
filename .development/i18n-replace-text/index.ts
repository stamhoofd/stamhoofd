// import { translateVueFileHelper } from './src/translate-vue-files';
// translateVueFileHelper('/Users/bjarne/Projects/stamhoofd/frontend/app/admin/src/views/finances/ChargeMembershipsView.vue', {doPrompt: true}, true);

import { translateVueFiles } from "./src/translate-vue-files";

translateVueFiles({dryRun: true, doPrompt: true, replaceChangesOnly: false});



// import { test } from './src/test-parser';

// test();
