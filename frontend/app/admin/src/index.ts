// import 'core-js/stable'; // only needed for entry or 'false' useBuiltIns
// import 'regenerator-runtime/runtime'; // only needed for entry or 'false' useBuiltIns

// Load icon font
import 'virtual:vite-svg-2-webfont.css';

import { ViewportHelper, VueGlobalHelper } from "@stamhoofd/components";
import { AppManager } from "@stamhoofd/networking";
import Vue from "vue";

import App from "./App.vue";

document.body.classList.add((AppManager.shared.isNative ? "native-" :  "web-")+AppManager.shared.getOS());
VueGlobalHelper.setup()

const app = new Vue({
    render: (h) => h(App),
});
(window as any).app = app;
ViewportHelper.setup(true);

app.$mount("#app");