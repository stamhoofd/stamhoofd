import { replaceAllVueTemplateText } from "./src/replace-text-vue";

replaceAllVueTemplateText({replaceChangesOnly: true});
// getChangedFiles('vue').forEach(element => {
//     console.log(element)
// });
// replaceAllVueTemplateText()
// replaceVueTemplateText('/Users/bjarne/Projects/stamhoofd/frontend/app/admin/src/views/settings/registration-periods/EditRegistrationPeriodView.vue');
// replaceTextInTypescript();

// getDiffChunks('/Users/bjarne/Projects/stamhoofd/.development/i18n-replace-text/src/replace-text-vue.ts').forEach(chunk => {
//     console.log(`@@line number: ${chunk.lineNumber}`);
//     chunk.newLineValues.forEach(value => {
//         console.log('- ' + value);
//     })
// })
