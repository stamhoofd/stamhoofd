import { UrlHelper } from '@browser/navigation';
import { Toast } from '@stamhoofd/frontend-notifications/Toast';
import { Platform } from '@stamhoofd/structures';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SessionContext } from './SessionContext.ts';
import type { SessionPresentationCallbacks } from './SessionPresentation';
import { configureSessionPresentation, getSessionPresentation } from './SessionPresentation';

describe('SessionContext.checkImpersonation', () => {
    const originalHash = UrlHelper.initial.url.hash;
    let questions: Parameters<SessionPresentationCallbacks['confirm']>[0][] = [];
    let restore: SessionPresentationCallbacks;
    const toastOwner = {};
    let notifications: Toast[] = [];

    /**
     * Answer every confirmation with 'no': nobody is signed in, so no request is made and the
     * only thing left to assert is whether the ticket was picked up at all.
     */
    beforeEach(() => {
        questions = [];
        notifications = [];
        Toast.addListener(toastOwner, toast => notifications.push(toast));
        restore = getSessionPresentation();
        configureSessionPresentation({
            async confirm(options) {
                questions.push(options);
                return false;
            },
        });
    });

    afterEach(() => {
        Toast.removeListener(toastOwner);
        vi.restoreAllMocks();
        configureSessionPresentation(restore);
        UrlHelper.initial.url.hash = originalHash;
    });

    function createSession() {
        return new SessionContext(null, Platform.create({}));
    }

    test('the ticket is read from the url as it was when the page loaded', async () => {
        // The application rewrites the address bar while it boots (locale prefix, url of the view
        // that is shown), and that drops the fragment before this check ever runs.
        UrlHelper.initial.url.hash = 'impersonate=my-ticket';
        expect(window.location.hash).not.toContain('impersonate');

        await createSession().checkImpersonation();

        expect(questions.length).toBe(1);
    });

    test('the ticket is used at most once', async () => {
        UrlHelper.initial.url.hash = 'impersonate=my-ticket';

        const session = createSession();
        await session.checkImpersonation();
        await session.checkImpersonation();

        expect(questions.length).toBe(1);
        expect(UrlHelper.initial.getHashParams().get('impersonate')).toBeNull();
    });

    test('other fragment parameters are kept', async () => {
        UrlHelper.initial.url.hash = 'impersonate=my-ticket&other=value';

        await createSession().checkImpersonation();

        expect(UrlHelper.initial.getHashParams().get('other')).toBe('value');
    });

    test('nothing is asked without a ticket', async () => {
        UrlHelper.initial.url.hash = '';

        await createSession().checkImpersonation();

        expect(questions.length).toBe(0);
    });

    test('an existing session receives a shared error toast without asking for confirmation', async () => {
        UrlHelper.initial.url.hash = 'impersonate=my-ticket';
        const session = createSession();
        vi.spyOn(session, 'hasToken').mockReturnValue(true);

        await session.checkImpersonation();

        expect(questions).toHaveLength(0);
        expect(notifications).toHaveLength(1);
        expect(notifications[0]).toMatchObject({ message: $t('%Zm9'), icon: 'error red', autohideAfter: 30000 });
        expect(UrlHelper.initial.getHashParams().get('impersonate')).toBeNull();
    });

    test('a failed impersonation request uses shared error formatting and the original timeout', async () => {
        UrlHelper.initial.url.hash = 'impersonate=my-ticket';
        configureSessionPresentation({ confirm: async () => true });
        const session = createSession();
        const server = session.identityServer;
        vi.spyOn(session, 'identityServer', 'get').mockReturnValue(server);
        vi.spyOn(server, 'request').mockRejectedValue(new Error('Inloggen mislukt'));
        vi.spyOn(console, 'error').mockImplementation(() => {});

        await session.checkImpersonation();

        expect(notifications).toHaveLength(1);
        expect(notifications[0]).toMatchObject({ message: 'Inloggen mislukt', icon: 'error red', autohideAfter: 30000 });
    });
});
