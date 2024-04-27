// import 'core-js/stable'; // only needed for entry or 'false' useBuiltIns
// import 'regenerator-runtime/runtime'; // only needed for entry or 'false' useBuiltIns

// Load icon font
// require('@stamhoofd/assets/images/icons/icons.font');
import 'virtual:vite-svg-2-webfont.css';

// Continue
import * as Sentry from '@sentry/vue';
import { ViewportHelper, VueGlobalHelper } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { AppManager } from '@stamhoofd/networking';
import Vue from "vue";
import VueMeta from 'vue-meta'

Vue.use(VueMeta)
const isPrerender = navigator.userAgent.toLowerCase().indexOf('prerender') !== -1;

if (!isPrerender && STAMHOOFD.environment == "production") {
    Sentry.init({
        Vue,
        dsn: "https://00c3e526a886491e853cf060f3b00b05@o431770.ingest.sentry.io/6002539",
        logErrors: true
    });
}

document.body.classList.add((AppManager.shared.isNative ? "native-" :  "web-")+AppManager.shared.getOS());

import App from "./App.vue";
VueGlobalHelper.setup()

const i18n = I18nController.getI18n()
const app = new Vue({
    i18n,
    render: (h) => h(App),
});

(window as any).app = app;

if (!isPrerender) {
    ViewportHelper.setup(true)

    // Load plausible if not production
    if (STAMHOOFD.environment == "production") {
        const script = document.createElement('script');
        script.onload = function () {
            //do stuff with the script
            console.log("Plausible loaded")
        };
        script.setAttribute("data-domain", "stamhoofd.app");
        script.src = "https://plausible.io/js/plausible.js";
        document.head.appendChild(script); //or something of the likes
        const w = (window as any);
        w.plausible = w.plausible || function() { (w.plausible.q = w.plausible.q || []).push(arguments) }
    } else {
        (window as any).plausible = function() {
            console.log("Debug plausible with args ", arguments)
        }
    }
}

app.$mount("#app")