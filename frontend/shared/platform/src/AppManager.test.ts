import { SessionDeviceType, SessionOS } from '@stamhoofd/structures';
import { afterEach, describe, expect, test } from 'vitest';
import { AppManager } from './AppManager.ts';

type Expected = {
    deviceType: SessionDeviceType;
    osName: SessionOS | null;
    osVersion: string | null;
    browserName: string;
};

type Case = [name: string, userAgent: string, expected: Expected, maxTouchPoints?: number];

const { Phone, Tablet, Desktop } = SessionDeviceType;

function mockNavigator(userAgent: string, maxTouchPoints: number) {
    Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true });
}

afterEach(() => {
    delete (navigator as any).userAgent;
    delete (navigator as any).maxTouchPoints;
});

/**
 * Real-world user agents (collected August 2026). Gotchas these pin down:
 * - Chrome UA reduction freezes the platform: 'Android 10; K', 'Windows NT 10.0', 'Mac OS X 10_15_7', 'CrOS x86_64 14541.0.0'.
 * - Safari freezes 'Mac OS X 10_15_7' and, since iOS 26, 'iPhone OS 18_x' while Version/ keeps moving.
 * - iPad Safari in its default desktop mode sends the exact macOS Safari string; only maxTouchPoints differs.
 * - Android phone vs tablet is only the presence of the 'Mobile' token.
 */
const phones: Case[] = [
    ['iPhone Safari (iOS 26)', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1', { deviceType: Phone, osName: SessionOS.iOS, osVersion: '18.6', browserName: 'Safari' }],
    ['iPhone Safari (iOS 18)', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3.1 Mobile/15E148 Safari/604.1', { deviceType: Phone, osName: SessionOS.iOS, osVersion: '18.3.2', browserName: 'Safari' }],
    ['iPhone Chrome', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/152.0.7977.53 Mobile/15E148 Safari/604.1', { deviceType: Phone, osName: SessionOS.iOS, osVersion: '18.7', browserName: 'Chrome' }],
    ['iPhone Firefox', 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7_9 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/154.0 Mobile/15E148 Safari/605.1.15', { deviceType: Phone, osName: SessionOS.iOS, osVersion: '15.7.9', browserName: 'Firefox' }],
    ['iPhone Edge', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 EdgiOS/151.4129.86 Mobile/15E148 Safari/605.1.15', { deviceType: Phone, osName: SessionOS.iOS, osVersion: '18.7.8', browserName: 'Edge' }],
    ['iPhone DuckDuckGo', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 DuckDuckGo/7 Safari/605.1.15', { deviceType: Phone, osName: SessionOS.iOS, osVersion: '18.6.2', browserName: 'DuckDuckGo' }],
    ['iPhone Facebook in-app browser', 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23G5052d Safari/604.1 [FBAN/FBIOS;FBAV/571.0.0.55.72;FBBV/1023852577;FBDV/iPhone16,1;FBMD/iPhone;FBSN/iOS;FBSV/26.6;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5;FBRV/1029358727;IABMV/1]', { deviceType: Phone, osName: SessionOS.iOS, osVersion: '26.6', browserName: 'Safari' }],
    ['iPhone Instagram in-app browser', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22H352 Instagram 440.0.0.30.81', { deviceType: Phone, osName: SessionOS.iOS, osVersion: '18.7', browserName: 'Other' }],
    ['iPhone Google app', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/360.1.737798518 Mobile/15E148 Safari/604.1', { deviceType: Phone, osName: SessionOS.iOS, osVersion: '18.3.2', browserName: 'Safari' }],
    ['Android Chrome (Galaxy, Pixel, ...)', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36', { deviceType: Phone, osName: SessionOS.Android, osVersion: '10', browserName: 'Chrome' }],
    ['Android Samsung Internet', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/143.0.0.0 Mobile Safari/537.36', { deviceType: Phone, osName: SessionOS.Android, osVersion: '10', browserName: 'SamsungBrowser' }],
    ['Android Firefox', 'Mozilla/5.0 (Android 16; Mobile; rv:152.0) Gecko/152.0 Firefox/152.0', { deviceType: Phone, osName: SessionOS.Android, osVersion: '16', browserName: 'Firefox' }],
    ['Android Edge', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36 EdgA/150.0.0.0', { deviceType: Phone, osName: SessionOS.Android, osVersion: '10', browserName: 'Edge' }],
    ['Android Opera', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36 OPR/100.0.0.0', { deviceType: Phone, osName: SessionOS.Android, osVersion: '10', browserName: 'Opera' }],
    ['Android DuckDuckGo', 'Mozilla/5.0 (Linux; Android 17) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.47 Mobile DuckDuckGo/5 Safari/537.36', { deviceType: Phone, osName: SessionOS.Android, osVersion: '17', browserName: 'DuckDuckGo' }],
    ['Android Ecosia', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36 (Ecosia android@149.0.0.0)', { deviceType: Phone, osName: SessionOS.Android, osVersion: '10', browserName: 'Ecosia' }],
    ['Android WebView (reduced)', 'Mozilla/5.0 (Linux; Android 10; K; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36', { deviceType: Phone, osName: SessionOS.Android, osVersion: '10', browserName: 'Chrome' }],
    ['Android WebView (Galaxy S23 Ultra, unreduced)', 'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/121.0.6167.178 Mobile Safari/537.36', { deviceType: Phone, osName: SessionOS.Android, osVersion: '14', browserName: 'Chrome' }],
    ['Android Instagram in-app browser (Pixel 10 Pro XL)', 'Mozilla/5.0 (Linux; Android 17; Pixel 10 Pro XL Build/CP2A.260705.006; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/151.0.7922.97 Mobile Safari/537.36 Instagram 441.0.0.0.72', { deviceType: Phone, osName: SessionOS.Android, osVersion: '17', browserName: 'Chrome' }],
];

const tablets: Case[] = [
    ['iPad Safari (desktop mode, default since iPadOS 13)', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15', { deviceType: Tablet, osName: SessionOS.iPadOS, osVersion: '10.15.7', browserName: 'Safari' }, 5],
    ['iPad Safari (request mobile website)', 'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1', { deviceType: Tablet, osName: SessionOS.iPadOS, osVersion: '18.6', browserName: 'Safari' }, 5],
    ['iPad Chrome', 'Mozilla/5.0 (iPad; CPU OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/152.0.7977.53 Mobile/15E148 Safari/604.1', { deviceType: Tablet, osName: SessionOS.iPadOS, osVersion: '18.7', browserName: 'Chrome' }, 5],
    ['iPad Firefox', 'Mozilla/5.0 (iPad; CPU OS 15_7_9 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/154.0 Mobile/15E148 Safari/605.1.15', { deviceType: Tablet, osName: SessionOS.iPadOS, osVersion: '15.7.9', browserName: 'Firefox' }, 5],
    ['Android tablet Chrome (Galaxy Tab)', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', { deviceType: Tablet, osName: SessionOS.Android, osVersion: '10', browserName: 'Chrome' }, 5],
    ['Android tablet Samsung Internet', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Safari/537.36', { deviceType: Tablet, osName: SessionOS.Android, osVersion: '10', browserName: 'SamsungBrowser' }, 5],
    ['Android tablet Firefox', 'Mozilla/5.0 (Android 16; Tablet; rv:152.0) Gecko/152.0 Firefox/152.0', { deviceType: Tablet, osName: SessionOS.Android, osVersion: '16', browserName: 'Firefox' }, 5],
];

const desktops: Case[] = [
    ['macOS Safari', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15', { deviceType: Desktop, osName: SessionOS.MacOS, osVersion: '10.15.7', browserName: 'Safari' }],
    ['macOS Safari 17', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.10 Safari/605.1.15', { deviceType: Desktop, osName: SessionOS.MacOS, osVersion: '10.15.7', browserName: 'Safari' }],
    ['macOS Chrome', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', { deviceType: Desktop, osName: SessionOS.MacOS, osVersion: '10.15.7', browserName: 'Chrome' }],
    ['macOS Firefox', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15.7; rv:154.0) Gecko/20100101 Firefox/154.0', { deviceType: Desktop, osName: SessionOS.MacOS, osVersion: '15.7', browserName: 'Firefox' }],
    ['macOS Firefox (resist fingerprinting)', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:152.0) Gecko/20100101 Firefox/153.0', { deviceType: Desktop, osName: SessionOS.MacOS, osVersion: '10.15', browserName: 'Firefox' }],
    ['macOS Edge', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.4129.86', { deviceType: Desktop, osName: SessionOS.MacOS, osVersion: '10.15.7', browserName: 'Edge' }],
    ['macOS Opera', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 OPR/124.0.0.0', { deviceType: Desktop, osName: SessionOS.MacOS, osVersion: '10.15.7', browserName: 'Opera' }],
    ['Windows 10/11 Chrome', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', { deviceType: Desktop, osName: SessionOS.Windows, osVersion: '10.0', browserName: 'Chrome' }],
    ['Windows Firefox', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:154.0) Gecko/20100101 Firefox/154.0', { deviceType: Desktop, osName: SessionOS.Windows, osVersion: '10.0', browserName: 'Firefox' }],
    ['Windows Edge', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.4129.86', { deviceType: Desktop, osName: SessionOS.Windows, osVersion: '10.0', browserName: 'Edge' }],
    ['Windows Opera', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 OPR/134.0.0.0', { deviceType: Desktop, osName: SessionOS.Windows, osVersion: '10.0', browserName: 'Opera' }],
    // DuckDuckGo for Windows sends a stock Edge user agent, so it can't be told apart
    ['Windows DuckDuckGo', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 Edg/110.0.1587.46', { deviceType: Desktop, osName: SessionOS.Windows, osVersion: '10.0', browserName: 'Edge' }],
    ['Linux Chrome', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', { deviceType: Desktop, osName: SessionOS.Linux, osVersion: null, browserName: 'Chrome' }],
    ['Linux Firefox', 'Mozilla/5.0 (X11; Linux x86_64; rv:154.0) Gecko/20100101 Firefox/154.0', { deviceType: Desktop, osName: SessionOS.Linux, osVersion: null, browserName: 'Firefox' }],
    ['Ubuntu Firefox', 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:154.0) Gecko/20100101 Firefox/154.0', { deviceType: Desktop, osName: SessionOS.Linux, osVersion: null, browserName: 'Firefox' }],
    ['Linux Opera', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 OPR/134.0.0.0', { deviceType: Desktop, osName: SessionOS.Linux, osVersion: null, browserName: 'Opera' }],
    ['ChromeOS Chrome', 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', { deviceType: Desktop, osName: SessionOS.ChromeOS, osVersion: '14541.0.0', browserName: 'Chrome' }],
    // Touch screen laptops report maxTouchPoints > 1 too, only a Mac user agent with touch means iPad
    ['Windows touch screen laptop Chrome', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', { deviceType: Desktop, osName: SessionOS.Windows, osVersion: '10.0', browserName: 'Chrome' }, 10],
];

describe('AppManager.getSessionMetaData', () => {
    describe.each([
        ['phones', phones],
        ['tablets', tablets],
        ['desktops', desktops],
    ])('%s', (_, cases) => {
        test.each(cases)('%s', async (_, userAgent, expected, maxTouchPoints = 0) => {
            mockNavigator(userAgent, maxTouchPoints);
            const manager = new AppManager();

            const metaData = await manager.getSessionMetaData();

            expect(metaData).toMatchObject({ ...expected, deviceName: null, nativeAppVersion: null });
        });
    });

    describe('native apps', () => {
        test('iPhone app', async () => {
            mockNavigator('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148', 5);
            const manager = new AppManager();
            manager.platform = 'ios';
            manager.setVersion({ version: '2.40.0', build: '240' });
            manager.setNativeDeviceInfo(Promise.resolve({ name: 'iPhone van Simon', model: 'iPhone16,1', operatingSystem: 'ios', osVersion: '26.0' }));

            expect(await manager.getSessionMetaData()).toMatchObject({
                deviceType: Phone,
                deviceName: 'iPhone van Simon',
                osName: SessionOS.iOS,
                osVersion: '26.0',
                nativeAppVersion: '2.40.0',
                browserName: null,
            });
        });

        test('iPad app', async () => {
            mockNavigator('Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148', 5);
            const manager = new AppManager();
            manager.platform = 'ios';
            manager.setNativeDeviceInfo(Promise.resolve({ model: 'iPad14,3', operatingSystem: 'ios', osVersion: '26.0' }));

            expect(await manager.getSessionMetaData()).toMatchObject({
                deviceType: Tablet,
                deviceName: 'iPad14,3',
                osName: SessionOS.iPadOS,
                osVersion: '26.0',
                browserName: null,
            });
        });

        test('Android app', async () => {
            mockNavigator('Mozilla/5.0 (Linux; Android 10; K; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36', 5);
            const manager = new AppManager();
            manager.platform = 'android';
            manager.setNativeDeviceInfo(Promise.resolve({ name: 'Galaxy S24', model: 'SM-S921B', operatingSystem: 'android', osVersion: '15' }));

            expect(await manager.getSessionMetaData()).toMatchObject({
                deviceType: Phone,
                deviceName: 'Galaxy S24',
                osName: SessionOS.Android,
                osVersion: '15',
                browserName: null,
            });
        });

        test('Android app falls back to the user agent when native device info fails', async () => {
            mockNavigator('Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/121.0.6167.178 Mobile Safari/537.36', 5);
            const manager = new AppManager();
            manager.platform = 'android';
            manager.setNativeDeviceInfo(Promise.reject(new Error('Plugin not available')));

            expect(await manager.getSessionMetaData()).toMatchObject({
                deviceType: Phone,
                deviceName: null,
                osName: SessionOS.Android,
                osVersion: '14',
                browserName: null,
            });
        });
    });
});
