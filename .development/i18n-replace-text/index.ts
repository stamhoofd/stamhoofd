// import { translateVueFileHelper } from './src/translate-vue-files';
// translateVueFileHelper('/Users/bjarne/Projects/stamhoofd/frontend/app/admin/src/views/finances/ChargeMembershipsView.vue', {doPrompt: true, replaceChangesOnly: false, dryRun: true});


import { translateVueFiles } from "./src/translate-vue-files";

translateVueFiles({dryRun: true, doPrompt: true, replaceChangesOnly: false});



// import { test } from './src/test-parser';

// test();
// import { testAddChangeMarkers } from "./src/git-html-helper";

// testAddChangeMarkers()
