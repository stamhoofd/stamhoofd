// import { translateVueFileHelper } from './src/translate-vue-files';
// translateVueFileHelper('/Users/bjarne/Projects/stamhoofd/frontend/app/admin/src/views/finances/ChargeMembershipsView.vue', {doPrompt: true, replaceChangesOnly: false, dryRun: true});




import { translateVueFiles } from "./src/translate-vue-files";

// translateVueFiles({dryRun: true, doPrompt: true, replaceChangesOnly: true, commitsToCompare: ['48ca0aaa8aba9589581177ba7192a507549a5c0f', '022542984217e6dfbe78bade19ff9e1e8ed2c165']});

translateVueFiles({dryRun: false, doPrompt: true, doFix: true, replaceChangesOnly: true});

// import { test } from './src/test-parser';

// test();
// import { testAddChangeMarkers } from "./src/git-html-helper";

// testAddChangeMarkers()

// import { eslintFormatter } from "./src/eslint-formatter";

// eslintFormatter.tryFixFile('/Users/bjarne/Projects/stamhoofd/frontend/app/admin/src/views/settings/LabsView.vue')
