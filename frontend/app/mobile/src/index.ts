
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar, Style } from '@capacitor/status-bar';
import { HistoryManager } from '@simonbackx/vue-app-navigation';
//import smoothscroll from 'smoothscroll-polyfill';
import Vue from "vue";
import VueMeta from 'vue-meta'

Vue.use(VueMeta)

import App from "../../dashboard/src/App.vue";

const app = new Vue({
    render: (h) => h(App),
}).$mount("#app");

(window as any).app = app;

const throttle = (func, limit) => {
    let lastFunc;
    let lastRan;
    return function(height: number) {
        const context = this;
        // eslint-disable-next-line prefer-rest-params
        const args = arguments;
        if (lastRan) {
            clearTimeout(lastFunc);
        }
        lastRan = Date.now();
            
        lastFunc = setTimeout(function() {
            if (Date.now() - lastRan >= limit) {
                func.apply(context, args);
                lastRan = Date.now();
            }
        }, limit - (Date.now() - lastRan));
    };
};

function setKeyboardHeight(height: number) {
    document.documentElement.style.setProperty("--keyboard-height", `${height}px`);
    if (height > 0 && Capacitor.getPlatform() === 'android') {
        requestAnimationFrame(() => {
            document.activeElement?.scrollIntoView({ behavior: 'smooth', block: "center", inline: "center" });
        });
    }
}

const throttledSetKeyboardHeight = throttle(setKeyboardHeight, 150)

// Implement smooth keyboard behavior on both iOS and Android instead of the bad default handling
if (Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android') {

    // note: for this to work on android, android:windowSoftInputMode="adjustPan" is needed in the activity (manifest)
    // kick off the polyfill!
    //smoothscroll.polyfill();

    if (Capacitor.getPlatform() === 'ios') {
        StatusBar.setStyle({ style: Style.Light }).catch(e => console.error(e));
    }

    Keyboard.addListener('keyboardWillShow', info => {
        console.log('keyboard will show with height:', info.keyboardHeight, info);
        throttledSetKeyboardHeight(info.keyboardHeight)
        /*document.documentElement.style.setProperty("--keyboard-height", `${info.keyboardHeight}px`);
        requestAnimationFrame(() => {
            document.activeElement?.scrollIntoView({ behavior: 'smooth', block: "start", inline: "center" });
        });*/
    }).catch(e => console.error(e));

    Keyboard.addListener('keyboardDidShow', info => {
        console.log('keyboard did show with height:', info.keyboardHeight, info);
    }).catch(e => console.error(e));

    Keyboard.addListener('keyboardWillHide', () => {
        console.log('keyboard will hide');
        throttledSetKeyboardHeight(0)
    }).catch(e => console.error(e));
}

// Faster click handling
// eslint-disable-next-line @typescript-eslint/no-empty-function
document.body.addEventListener("touchstart", () => { }, { passive: true });

// Force set margin of navigation bar (disable jumping when scrolling which is only needed on webistes)
document.documentElement.style.setProperty("--navigation-bar-margin", `0px`);

// Disable swipe back animations (or they will play twice)
HistoryManager.animateHistoryPop = false;

// Click next to an input to blur it and lose focus (remove the keyboard)
(document.body.firstElementChild! as HTMLElement).tabIndex = -1