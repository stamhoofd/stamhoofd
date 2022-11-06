// Load icon font
require('@stamhoofd/assets/images/icons/icons.font');

import { App as CApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { Keyboard } from '@capacitor/keyboard';
import { HistoryManager } from '@simonbackx/vue-app-navigation';
import { ViewportHelper, VueGlobalHelper } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import Vue from "vue";
import VueMeta from 'vue-meta'

import { AppManager, SessionManager, Storage } from '../../../shared/networking';
// Kick off the app
import App from "../../dashboard/src/App.vue";
import { CapacitorStorage } from './CapacitorStorage';
import QRScanner from './QRScannerPlugin';
import { WrapperHTTPRequest } from './WrapperHTTPRequest';

Vue.use(VueMeta)

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
    document.documentElement.style.setProperty("--keyboard-open", `${height > 0 ? '1' : '0'}`);
    document.documentElement.style.setProperty("--keyboard-closed", `${height > 0 ? '0' : '1'}`);

    if (height > 0 && Capacitor.getPlatform() === 'android') {
        requestAnimationFrame(() => {
            document.activeElement?.scrollIntoView({ behavior: 'smooth', block: "center", inline: "center" });
        });
    }
}

const throttledSetKeyboardHeight = throttle(setKeyboardHeight, 100)

// Implement smooth keyboard behavior on both iOS and Android instead of the bad default handling
if (Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android') {
    AppManager.shared.platform = Capacitor.getPlatform() as "android" | "ios" | "web"

    // Force set margin of navigation bar (disable jumping when scrolling which is only needed on webistes)
    document.documentElement.style.setProperty("--navigation-bar-margin", `0px`);

    // note: for this to work on android, android:windowSoftInputMode="adjustPan" is needed in the activity (manifest)
    // kick off the polyfill!
    //

    if (Capacitor.getPlatform() === 'ios') {
        //StatusBar.setStyle({ style: Style.Light }).catch(e => console.error(e));

        // Disable swipe back animations (or they will play twice)
        HistoryManager.animateHistoryPop = false;

        // Use the iOS scanning plugin
        AppManager.shared.QRScanner = QRScanner
    }

    Keyboard.addListener('keyboardWillShow', info => {
        //console.log('keyboard will show with height:', info.keyboardHeight, info);
        throttledSetKeyboardHeight(info.keyboardHeight)
        /*document.documentElement.style.setProperty("--keyboard-height", `${info.keyboardHeight}px`);
        requestAnimationFrame(() => {
            document.activeElement?.scrollIntoView({ behavior: 'smooth', block: "start", inline: "center" });
        });*/
    }).catch(e => console.error(e));

    Keyboard.addListener('keyboardDidShow', info => {
        //console.log('keyboard did show with height:', info.keyboardHeight, info);
    }).catch(e => console.error(e));

    Keyboard.addListener('keyboardWillHide', () => {
        //console.log('keyboard will hide');
        throttledSetKeyboardHeight(0)
    }).catch(e => console.error(e));
}

// Fix for prosemirror scrollIntoView causing all overflow hidden elements to also scroll (need to make a PR to prosemirror to fix this)
window.addEventListener("scroll", () => {
    // Disalbe scrolling the body
    requestAnimationFrame(() => {
        if (document.documentElement.scrollTop > 0) {
            document.documentElement.scrollTop = 0
        }

        // Fixes an iOS bug where documentElement is not scrolled, but body is
        if (document.body.scrollTop > 0) {
            document.body.scrollTop = 0
        }
    });
}, { passive: true });

// Faster click handling
// eslint-disable-next-line @typescript-eslint/no-empty-function
window.addEventListener("touchstart", () => { }, { passive: true });

document.body.style.userSelect = "none";
(document.body.style as any).webkitTouchCallout = "none";
(document.body.style as any).webkitUserSelect = "none";

// Plausible placeholder
(window as any).plausible = function() {
    //console.log("Debug plausible with args ", arguments)
}

// Override XMLHttpRequest in some situation (S&GV) since we don't have domain here
AppManager.shared.overrideXMLHttpRequest = WrapperHTTPRequest
const i18n = I18nController.getI18n()
I18nController.addUrlPrefix = false

document.body.classList.add((AppManager.shared.isNative ? "native-" :  "web-")+AppManager.shared.getOS());
VueGlobalHelper.setup()

Vue.prototype.$isMobile = true

const app = new Vue({
    i18n,
    render: (h) => h(App),
}).$mount("#app");

(window as any).app = app;

CApp.addListener('appUrlOpen', (data: any) => {
    console.log("Open app url location:", data)
    const url = new URL(data.url);
    window.location.href = url.pathname + url.search
    console.log(url.pathname + url.search)
}).catch(console.error);

// Replace default storage mechanism for some things
Storage.secure = new CapacitorStorage()
Storage.keychain = new CapacitorStorage()

AppManager.shared.hapticError = () => {
    Haptics.notification({ type: NotificationType.Error }).catch(console.error);
}

AppManager.shared.hapticWarning = () => {
    Haptics.notification({ type: NotificationType.Warning }).catch(console.error);
}

AppManager.shared.hapticSuccess = () => {
    Haptics.notification({ type: NotificationType.Success }).catch(console.error);
}

AppManager.shared.hapticTap = () => {
    Haptics.notification({ type: NotificationType.Success }).catch(console.error);
}

import { RateApp } from 'capacitor-rate-app';

async function markReviewMoment() {
    // 1. Check if we are signed in.
    const session = SessionManager.currentSession

    if (!session) {
        return
    }

    if (!session.organization) {
        return
    }
    
    // Check if at least one package active (only ask reviews to organizations who bought the app)
    if ((session.organization.meta.packages.useMembers && !session.organization.meta.packages.isMembersTrial) || (session.organization.meta.packages.useWebshops && !session.organization.meta.packages.isWebshopsTrial)) {
        // Use a counter, that can only increment once a day
        const counterRaw = await Storage.keyValue.getItem("reviewCounter")
        let counter = counterRaw ? parseInt(counterRaw) : 0
        if (isNaN(counter)) {
            counter = 0
        }
        const lastDateRaw = await Storage.keyValue.getItem("reviewLastCounterIncrease")
        const lastDate = lastDateRaw ? new Date(parseInt(lastDateRaw)) : new Date(0)

        // Only increase counter if last counter increase was at least 2 hours ago
        if (lastDate < new Date(Date.now() - 2 * 60 * 60 * 1000)) {
            counter++

            // When the counter reaches 4, we'll ask for a review and reset the counter
            if (counter >= 4) {
                // Ask for a review
                RateApp.requestReview().catch(console.error);
                counter = 0
            }
        
            // Save this date
            await Storage.keyValue.setItem("reviewLastCounterIncrease", Date.now().toString())
        }

        await Storage.keyValue.setItem("reviewCounter", counter.toString())
    }
}

AppManager.shared.markReviewMoment = () => {
    markReviewMoment().catch(console.error)
}


window.addEventListener('statusTap',  () => {
    console.log("Status tapped")
    const element = document.querySelector(".st-view > main") as HTMLElement
    if (element) {
        // Smooth scroll has just landed in Safari TP, we'll wait a bit before we implement it here

        // Scroll to top
        // Stop current scroll acceleration before initiating a new one
        
        const exponential = function(x: number): number {
            return x === 1 ? 1 : 1 - Math.pow(1.5, -20 * x);
        }

        ViewportHelper.scrollTo(element, 0, Math.min(600, Math.max(300, element.scrollTop / 2)), exponential)
        
    }
});

import { Directory,Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

import FileOpener from './FileOpenerPlugin';


// Download File
AppManager.shared.downloadFile = async (data: any, filename: string) => {
    const {publicStorage} = await Filesystem.checkPermissions();
    if (!publicStorage) {
        throw new Error("Geen toegang tot bestanden. Wijzig de toestemmingen van de app om bestanden te kunnen opslaan.")
    }

    // TODO: automatically encode data to base64 in case of buffer

    const result = await Filesystem.writeFile({
        path: filename,
        data,
        directory: Directory.External,
        // encoding: Encoding.UTF8, // if not present: data should be base64 encoded
    });

    try {
        if (Capacitor.getPlatform() === 'ios') {
            await Share.share({
                dialogTitle: filename,
                url: result.uri,
            });
        } else {
            await FileOpener.open({url: result.uri})
        }
    } catch (e) {
        if (e.message === "Share canceled" || e.message === "Error sharing item") {
            return
        }
        throw e
    }
}