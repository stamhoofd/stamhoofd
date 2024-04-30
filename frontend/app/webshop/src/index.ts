// import 'core-js/stable'; // only needed for entry or 'false' useBuiltIns
// import 'regenerator-runtime/runtime'; // only needed for entry or 'false' useBuiltIns

// Load icon font
import 'virtual:vite-svg-2-webfont.css';

import * as Sentry from "@sentry/vue";
import { ViewportHelper, VueGlobalHelper } from "@stamhoofd/components";
import { I18nController } from "@stamhoofd/frontend-i18n";
import { AppManager } from "@stamhoofd/networking";
import Vue from "vue";
import { createApp } from 'vue'

const isPrerender = navigator.userAgent.toLowerCase().indexOf('prerender') !== -1;

if (!isPrerender && STAMHOOFD.environment == "production") {
    Sentry.init({
        Vue,
        dsn: "https://68f75e2911164d23ba77dde7398e609f@o431770.ingest.sentry.io/6002542",
        logErrors: true
    });
}

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