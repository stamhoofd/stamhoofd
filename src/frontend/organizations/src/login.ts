import Vue from "vue";

import LoginWindow from "./views/login/LoginWindow.vue";

Vue.config.productionTip = false;

new Vue({
    render: (h) => h(LoginWindow),
}).$mount("#app");

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
    w.visualViewport.addEventListener('scroll', viewportHandler);
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