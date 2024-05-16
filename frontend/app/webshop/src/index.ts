// import 'core-js/stable'; // only needed for entry or 'false' useBuiltIns
// import 'regenerator-runtime/runtime'; // only needed for entry or 'false' useBuiltIns

// Load icon font
import 'virtual:vite-svg-2-webfont.css';

import { ViewportHelper, VueGlobalHelper } from "@stamhoofd/components";
import { I18nController } from "@stamhoofd/frontend-i18n";
import { AppManager } from "@stamhoofd/networking";
import { createApp } from 'vue'

const isPrerender = navigator.userAgent.toLowerCase().indexOf('prerender') !== -1;

import App from "./App.vue";

document.body.classList.add((AppManager.shared.isNative ? "native-" :  "web-")+AppManager.shared.getOS());

const app = createApp(App);
VueGlobalHelper.setup(app)

const i18n = I18nController.getI18n()
I18nController.fixedCountry = true
app.use(i18n);

if (!isPrerender) {
    ViewportHelper.setup(true)
}

app.mount("#app")
