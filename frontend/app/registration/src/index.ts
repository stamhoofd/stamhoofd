// import 'core-js/stable'; // only needed for entry or 'false' useBuiltIns
// import 'regenerator-runtime/runtime'; // only needed for entry or 'false' useBuiltIns

import * as Sentry from "@sentry/vue";
import { I18nController } from "@stamhoofd/frontend-i18n";
import Vue from "vue";
import VueMeta from 'vue-meta'

Vue.use(VueMeta)

const isPrerender = navigator.userAgent.toLowerCase().indexOf('prerender') !== -1;

if (!isPrerender && process.env.NODE_ENV == "production") {
    Sentry.init({
        Vue,
        dsn: "https://23478e05aa5948959641d836213ba82c@o431770.ingest.sentry.io/6002543",
        logErrors: true
    });
}

import App from "./App.vue";
const i18n = I18nController.getI18n()
I18nController.fixedCountry = true

const app = new Vue({
    i18n,
    render: (h) => h(App),
}).$mount("#app");

(window as any).app = app;

// First we get the viewport height and we multiple it by 1% to get a value for a vh unit
let currentVh = document.documentElement.clientHeight * 0.01;
// Then we set the value in the --vh custom property to the root of the document
document.documentElement.style.setProperty("--vh", `${currentVh}px`);

const w = window as any;
if (w.visualViewport) {
    let pendingUpdate = false;
    const viewportHandler = (event) => {
        if (pendingUpdate) return;
        pendingUpdate = true;

        requestAnimationFrame(() => {
            pendingUpdate = false;
            const viewport = event.target;
            const height = viewport.height;

            // We execute the same script as before
            const vh = height * 0.01;

            if (vh == currentVh) {
                return;
            }
            currentVh = vh;
            document.documentElement.style.setProperty("--vh", `${vh}px`);
        });
    };
    //w.visualViewport.addEventListener('scroll', viewportHandler);
    w.visualViewport.addEventListener('resize', viewportHandler);
} else {
    // We listen to the resize event
    window.addEventListener(
        "resize",
        () => {
            // We execute the same script as before
            const vh = document.documentElement.clientHeight * 0.01;
            if (vh == currentVh) {
                return;
            }
            currentVh = vh;
            document.documentElement.style.setProperty("--vh", `${vh}px`);
        },
        { passive: true } as EventListenerOptions
    );

    // We listen to the resize event
    window.addEventListener(
        "focus",
        () => {
            // We execute the same script as before
            const vh = document.documentElement.clientHeight * 0.01;

            if (vh == currentVh) {
                return;
            }
            currentVh = vh;
            document.documentElement.style.setProperty("--vh", `${vh}px`);
        },
        { passive: true } as EventListenerOptions
    );
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
document.body.addEventListener("touchstart", () => { }, { passive: true });