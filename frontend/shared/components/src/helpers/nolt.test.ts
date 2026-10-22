import { UrlHelper } from '@simonbackx/vue-app-navigation';
import { TestUtils } from '@stamhoofd/test-utils';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent } from 'vue';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';

import { consumePendingNoltLogin, rememberPendingNoltLogin, useOpenPendingNoltLogin } from './nolt.ts';

describe('nolt', () => {
    const originalPathname = UrlHelper.initial.url.pathname;

    beforeEach(() => {
        TestUtils.setEnvironment('NOLT_URL', 'feedback.example.com');
        sessionStorage.clear();
    });

    afterEach(() => {
        UrlHelper.initial.url.pathname = originalPathname;
        sessionStorage.clear();
        vi.useRealTimers();
    });

    test('the intent is kept after navigating away until it is used once', () => {
        // Nolt sends visitors that want to sign in to this url
        UrlHelper.initial.url.pathname = '/auth/nolt';
        expect(rememberPendingNoltLogin()).toBe(true);

        // After choosing an organization and signing in (possibly via an SSO redirect), the url is different
        UrlHelper.initial.url.pathname = '/beheerders/scouts-gent';
        expect(rememberPendingNoltLogin()).toBe(false);

        expect(consumePendingNoltLogin()).toBe(true);
        expect(consumePendingNoltLogin()).toBe(false);
    });

    test('the locale prefix is ignored', () => {
        UrlHelper.initial.url.pathname = '/nl-BE/auth/nolt';
        expect(rememberPendingNoltLogin()).toBe(true);
        expect(consumePendingNoltLogin()).toBe(true);
    });

    test('other urls do not start a Nolt login', () => {
        UrlHelper.initial.url.pathname = '/beheerders/scouts-gent';
        expect(rememberPendingNoltLogin()).toBe(false);
        expect(consumePendingNoltLogin()).toBe(false);
    });

    test('nothing happens when Nolt is not configured', () => {
        TestUtils.setEnvironment('NOLT_URL', undefined);
        UrlHelper.initial.url.pathname = '/auth/nolt';
        expect(rememberPendingNoltLogin()).toBe(false);
        expect(consumePendingNoltLogin()).toBe(false);
    });

    test('an old intent is ignored', () => {
        vi.useFakeTimers();
        UrlHelper.initial.url.pathname = '/auth/nolt';
        expect(rememberPendingNoltLogin()).toBe(true);

        vi.advanceTimersByTime(60 * 60 * 1000);
        expect(consumePendingNoltLogin()).toBe(false);
    });

    describe('useOpenPendingNoltLogin', () => {
        function createContext(state: { complete: boolean; permissions: { isEmpty: boolean } | null }) {
            const listeners = new Map<unknown, () => void>();
            return {
                listeners,
                user: { email: 'admin@example.com' },
                auth: {
                    get permissions() {
                        return state.permissions;
                    },
                },
                isComplete: () => state.complete,
                addListener: (owner: unknown, listener: () => void) => listeners.set(owner, listener),
                removeListener: (owner: unknown) => listeners.delete(owner),
                callListeners: () => listeners.forEach(listener => listener()),
            };
        }

        function mountHook(context: ReturnType<typeof createContext>) {
            return mount(defineComponent(() => {
                useOpenPendingNoltLogin();
                return () => null;
            }), { global: { provide: { $context: context } } });
        }

        beforeEach(() => {
            UrlHelper.initial.url.pathname = '/auth/nolt';
            rememberPendingNoltLogin();
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        test('Nolt opens once the user signs in as an admin', () => {
            // Without a trusted referrer, opening Nolt first asks for confirmation
            const confirm = vi.spyOn(CenteredMessage, 'confirm').mockResolvedValue(false);
            const state = { complete: false, permissions: null as { isEmpty: boolean } | null };
            const context = createContext(state);
            const wrapper = mountHook(context);
            expect(confirm).not.toHaveBeenCalled();

            state.complete = true;
            state.permissions = { isEmpty: false };
            context.callListeners();
            expect(confirm).toHaveBeenCalledOnce();

            context.callListeners();
            expect(confirm).toHaveBeenCalledOnce();

            wrapper.unmount();
            expect(context.listeners.size).toBe(0);
        });

        test('the intent is kept when the user has no admin access to the organization', () => {
            const confirm = vi.spyOn(CenteredMessage, 'confirm').mockResolvedValue(false);
            const wrapper = mountHook(createContext({ complete: true, permissions: { isEmpty: true } }));

            expect(confirm).not.toHaveBeenCalled();
            expect(consumePendingNoltLogin()).toBe(true);
            wrapper.unmount();
        });
    });
});
