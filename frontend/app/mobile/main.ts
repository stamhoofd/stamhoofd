// Load icon font
import 'virtual:vite-svg-2-webfont.css';

import { App as CApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { Keyboard } from '@capacitor/keyboard';
import { Share } from '@capacitor/share';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { HistoryManager } from '@simonbackx/vue-app-navigation';
import { ViewportHelper, VueGlobalHelper } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { AppManager, SessionContext, Storage, UrlHelper } from '@stamhoofd/networking';
import { RateApp } from 'capacitor-rate-app';
import { createApp } from 'vue';

import App from '../dashboard/src/App.vue';
import { CapacitorStorage } from './src/CapacitorStorage';
import FileOpener from './src/FileOpenerPlugin';
import QRScanner from './src/QRScannerPlugin';
import { UpdateStatus } from './src/UpdateStatus';
import { WrapperHTTPRequest } from './src/WrapperHTTPRequest';

const throttle = (func, limit) => {
    let lastFunc;
    let lastRan;
    return function (height: number) {
        const context = this;
        // eslint-disable-next-line prefer-rest-params
        const args = arguments;
        if (lastRan) {
            clearTimeout(lastFunc);
        }
        lastRan = Date.now();

        lastFunc = setTimeout(function () {
            if (Date.now() - lastRan >= limit) {
                func.apply(context, args);
                lastRan = Date.now();
            }
        }, limit - (Date.now() - lastRan));
    };
};

function setKeyboardHeight(height: number) {
    document.documentElement.style.setProperty('--keyboard-height', `${height}px`);
    document.documentElement.style.setProperty('--keyboard-open', `${height > 0 ? '1' : '0'}`);
    document.documentElement.style.setProperty('--keyboard-closed', `${height > 0 ? '0' : '1'}`);

    if (height > 0 && Capacitor.getPlatform() === 'android') {
        requestAnimationFrame(() => {
            document.activeElement?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        });
    }
}

const throttledSetKeyboardHeight = throttle(setKeyboardHeight, 100);

// Implement smooth keyboard behavior on both iOS and Android instead of the bad default handling
if (Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android') {
    AppManager.shared.platform = Capacitor.getPlatform() as 'android' | 'ios' | 'web';

    // Force set margin of navigation bar (disable jumping when scrolling which is only needed on webistes)
    document.documentElement.style.setProperty('--navigation-bar-margin', `0px`);

    // note: for this to work on android, android:windowSoftInputMode="adjustPan" is needed in the activity (manifest)
    // kick off the polyfill!
    //

    if (Capacitor.getPlatform() === 'ios') {
        // StatusBar.setStyle({ style: Style.Light }).catch(e => console.error(e));

        // Disable swipe back animations (or they will play twice)
        HistoryManager.animateHistoryPop = false;

        // Use the iOS scanning plugin
        AppManager.shared.QRScanner = QRScanner;
    }

    Keyboard.addListener('keyboardWillShow', (info) => {
        // console.log('keyboard will show with height:', info.keyboardHeight, info);
        throttledSetKeyboardHeight(info.keyboardHeight);
        /* document.documentElement.style.setProperty("--keyboard-height", `${info.keyboardHeight}px`);
        requestAnimationFrame(() => {
            document.activeElement?.scrollIntoView({ behavior: 'smooth', block: "start", inline: "center" });
        }); */
    }).catch(e => console.error(e));

    Keyboard.addListener('keyboardDidShow', (info) => {
        // console.log('keyboard did show with height:', info.keyboardHeight, info);
    }).catch(e => console.error(e));

    Keyboard.addListener('keyboardWillHide', () => {
        // console.log('keyboard will hide');
        throttledSetKeyboardHeight(0);
    }).catch(e => console.error(e));
}

// Fix for prosemirror scrollIntoView causing all overflow hidden elements to also scroll (need to make a PR to prosemirror to fix this)
window.addEventListener('scroll', () => {
    // Disalbe scrolling the body
    requestAnimationFrame(() => {
        if (document.documentElement.scrollTop > 0) {
            document.documentElement.scrollTop = 0;
        }

        // Fixes an iOS bug where documentElement is not scrolled, but body is
        if (document.body.scrollTop > 0) {
            document.body.scrollTop = 0;
        }
    });
}, { passive: true });

// Faster click handling

window.addEventListener('touchstart', () => { }, { passive: true });

document.body.style.userSelect = 'none';
(document.body.style as any).webkitTouchCallout = 'none';
(document.body.style as any).webkitUserSelect = 'none';

if (STAMHOOFD.PLAUSIBLE_DOMAIN && STAMHOOFD.environment === 'production') {
    const script = document.createElement('script');
    script.onload = function () {
        // do stuff with the script
        console.log('Plausible loaded');
    };
    script.setAttribute('data-domain', STAMHOOFD.PLAUSIBLE_DOMAIN);
    script.src = 'https://plausible.io/js/plausible.js';
    document.head.appendChild(script); // or something of the likes
    const w = window as any;
    w.plausible = w.plausible || function () { (w.plausible.q = w.plausible.q || []).push(arguments); };
}
else {
    (window as any).plausible = function () {
        console.log('Debug plausible with args ', arguments);
    };
}

// Override XMLHttpRequest in some situation (S&GV) since we don't have domain here
AppManager.shared.overrideXMLHttpRequest = WrapperHTTPRequest;
document.body.classList.add((AppManager.shared.isNative ? 'native-' : 'web-') + AppManager.shared.getOS());

const app = createApp(App);
VueGlobalHelper.setup(app);

const i18n = I18nController.getI18n();
I18nController.addUrlPrefix = false;
app.use(i18n);

CapacitorUpdater.notifyAppReady().catch(console.error);

CApp.addListener('appUrlOpen', (data) => {
    console.log('Open app url location:', data);
    const url = new URL(data.url);
    window.location.href = url.pathname + url.search;
    console.log(url.pathname + url.search);
}).catch(console.error);

// Replace default storage mechanism for some things
Storage.secure = new CapacitorStorage();
Storage.keychain = new CapacitorStorage();

AppManager.shared.hapticError = () => {
    Haptics.notification({ type: NotificationType.Error }).catch(console.error);
};

AppManager.shared.hapticWarning = () => {
    Haptics.notification({ type: NotificationType.Warning }).catch(console.error);
};

AppManager.shared.hapticSuccess = () => {
    Haptics.notification({ type: NotificationType.Success }).catch(console.error);
};

AppManager.shared.hapticTap = () => {
    Haptics.notification({ type: NotificationType.Success }).catch(console.error);
};

async function markReviewMoment($context: SessionContext) {
    // 1. Check if we are signed in.
    if (!$context) {
        return;
    }

    if (!$context.organization) {
        return;
    }

    // Check if at least one package active (only ask reviews to organizations who bought the app)
    if (($context.organization.meta.packages.useMembers && !$context.organization.meta.packages.isMembersTrial) || ($context.organization.meta.packages.useWebshops && !$context.organization.meta.packages.isWebshopsTrial)) {
        // Use a counter, that can only increment once a day
        const counterRaw = await Storage.keyValue.getItem('reviewCounter');
        let counter = counterRaw ? parseInt(counterRaw) : 0;
        if (isNaN(counter)) {
            counter = 0;
        }
        const lastDateRaw = await Storage.keyValue.getItem('reviewLastCounterIncrease');
        const lastDate = lastDateRaw ? new Date(parseInt(lastDateRaw)) : new Date(0);

        // Only increase counter if last counter increase was at least 2 hours ago
        if (lastDate < new Date(Date.now() - 2 * 60 * 60 * 1000)) {
            counter++;

            // When the counter reaches 4, we'll ask for a review and reset the counter
            if (counter >= 4) {
                // Ask for a review
                RateApp.requestReview().catch(console.error);
                counter = 0;
            }

            // Save this date
            await Storage.keyValue.setItem('reviewLastCounterIncrease', Date.now().toString());
        }

        await Storage.keyValue.setItem('reviewCounter', counter.toString());
    }
}

AppManager.shared.markReviewMoment = ($context: SessionContext) => {
    markReviewMoment($context).catch(console.error);
};

window.addEventListener('statusTap', () => {
    console.log('Status tapped');
    const element = document.querySelector('.st-view > main') as HTMLElement;
    if (element) {
        // Smooth scroll has just landed in Safari TP, we'll wait a bit before we implement it here

        // Scroll to top
        // Stop current scroll acceleration before initiating a new one

        const exponential = function (x: number): number {
            return x === 1 ? 1 : 1 - Math.pow(1.5, -20 * x);
        };

        ViewportHelper.scrollTo(element, 0, Math.min(600, Math.max(300, element.scrollTop / 2)), exponential);
    }
});

function blobToBase64(blob: Blob | File): Promise<string> {
    return new Promise((resolve, _) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    });
}

// Download File
AppManager.shared.downloadFile = async (data: Blob | File | URL, filename: string) => {
    const { publicStorage } = await Filesystem.checkPermissions();
    if (!publicStorage) {
        throw new Error($t(`56958164-b35f-4b78-b286-c3c7ac9c539d`));
    }

    // TODO: automatically encode data to base64 in case of buffer
    let url: string;

    if (data instanceof URL) {
        url = data.href;
    }
    else {
        // Convert data to a string
        const base64String = await blobToBase64(data); // capacitor plugin will automatically remove the 'data:image/png;base64,' prefix

        const result = await Filesystem.writeFile({
            path: filename,
            data: base64String,
            directory: Directory.External,
            // encoding: Encoding.UTF8, // if not present: data should be base64 encoded
        });
        url = result.uri;
    }

    try {
        if (Capacitor.getPlatform() === 'ios') {
            await Share.share({
                dialogTitle: filename,
                url,
            });
        }
        else {
            await FileOpener.open({ url });
        }
    }
    catch (e) {
        if (e.message === 'Share canceled' || e.message === 'Error sharing item') {
            return;
        }
        throw e;
    }
};
let isCheckingUpdates = false;
let lastUpdateCheck: Date | null = null;
CApp.addListener('appStateChange', (state) => {
    if (state.isActive && STAMHOOFD.environment !== 'staging' && (lastUpdateCheck === null || lastUpdateCheck.getTime() < Date.now() - 5 * 1000)) {
        // (don't check on staging)
        AppManager.shared.checkUpdates({
            checkTimeout: 10 * 1000,
        }).catch(console.error);
    }
}).catch(console.error);

CApp.getInfo().then((info) => {
    AppManager.shared.setVersion({
        version: info.version,
        build: info.build,
    });
}).catch(console.error);

AppManager.shared.checkUpdates = async (options) => {
    if (isCheckingUpdates) {
        console.log('Already checking updates. Skipped.');
        return;
    }
    isCheckingUpdates = true;
    lastUpdateCheck = new Date();
    const status = new UpdateStatus(options);
    try {
        await status.start();
    }
    catch (e) {
        console.error(e);
    }
    isCheckingUpdates = false;
};

// Set the shared initial state if manually set
Storage.keyValue.getItem('next_url_load').then((path) => {
    if (path) {
        Storage.keyValue.removeItem('next_url_load').catch(console.error);
        UrlHelper.shared.setPath(path);
    }
}).catch(console.error);

app.mount('#app');
