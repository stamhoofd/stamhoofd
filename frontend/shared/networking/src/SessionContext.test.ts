import { UrlHelper } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage';
import { Platform } from '@stamhoofd/structures';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { SessionContext } from './SessionContext.ts';

describe('SessionContext.checkImpersonation', () => {
    const owner = {};
    const originalHash = UrlHelper.initial.url.hash;
    let questions: CenteredMessage[] = [];

    /**
     * Answer every confirmation with 'no': nobody is signed in, so no request is made and the
     * only thing left to assert is whether the ticket was picked up at all.
     */
    beforeEach(() => {
        questions = [];
        CenteredMessage.addListener(owner, (message) => {
            questions.push(message);
            const cancel = message.buttons[message.buttons.length - 1];
            cancel.action?.().catch(console.error);
        });
    });

    afterEach(() => {
        CenteredMessage.removeListener(owner);
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
});
