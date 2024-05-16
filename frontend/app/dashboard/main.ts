// import 'core-js/stable'; // only needed for entry or 'false' useBuiltIns
// import 'regenerator-runtime/runtime'; // only needed for entry or 'false' useBuiltIns

// Load icon font
import 'virtual:vite-svg-2-webfont.css';

// Continue
import { ViewportHelper, VueGlobalHelper } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { AppManager } from '@stamhoofd/networking';
import { createApp } from "vue"

import App from "./src/App.vue";

const isPrerender = navigator.userAgent.toLowerCase().indexOf('prerender') !== -1;

document.body.classList.add((AppManager.shared.isNative ? "native-" :  "web-")+AppManager.shared.getOS());

const app = createApp(App);
VueGlobalHelper.setup(app)

const i18n = I18nController.getI18n()
app.use(i18n)

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
app.mount("#app")
