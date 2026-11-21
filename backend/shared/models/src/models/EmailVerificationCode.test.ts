import { OrganizationFactory } from '../factories/OrganizationFactory.js';
import { UserFactory } from '../factories/UserFactory.js';
import { EmailVerificationCode } from './EmailVerificationCode.js';
import type { User } from './User.js';

describe('Model.EmailVerificationCode', () => {
    let user: User;

    beforeEach(async () => {
        const organization = await new OrganizationFactory({}).create();
        user = await new UserFactory({ organization }).create();
    });

    /**
     * Exhaust the tries of the current code, the way a requester guessing the code would.
     */
    async function exhaustTries(code: EmailVerificationCode) {
        code.tries = EmailVerificationCode.MAX_TRIES;
        await code.save();
    }

    test('a new code is issued for a code that ran out of tries', async () => {
        const code = await EmailVerificationCode.createFor(user, user.email);
        await exhaustTries(code);

        const second = await EmailVerificationCode.createFor(user, user.email);
        expect(second.code).not.toBe(code.code);
        expect(second.tries).toBe(0);
    });

    test('the same code is reused while it can still be tried', async () => {
        const code = await EmailVerificationCode.createFor(user, user.email);
        const second = await EmailVerificationCode.createFor(user, user.email);

        expect(second.code).toBe(code.code);
        expect(second.token).toBe(code.token);
        expect(second.generatedCount).toBe(1);
    });

    test('no new code is issued once the maximum amount of codes is reached', async () => {
        let code = await EmailVerificationCode.createFor(user, user.email);

        for (let i = 1; i < EmailVerificationCode.MAX_GENERATED_CODES; i++) {
            await exhaustTries(code);
            code = await EmailVerificationCode.createFor(user, user.email);
            expect(code.generatedCount).toBe(i + 1);
        }

        await exhaustTries(code);
        await expect(EmailVerificationCode.createFor(user, user.email)).rejects.toMatchObject({
            code: 'too_many_attempts',
        });

        // A different address doesn't buy a new code either
        await expect(
            EmailVerificationCode.createFor(user, 'other@example.com'),
        ).rejects.toMatchObject({
            code: 'too_many_attempts',
        });
    });

    test('a new code is issued again once the previous one expired', async () => {
        const code = await EmailVerificationCode.createFor(user, user.email);
        code.generatedCount = EmailVerificationCode.MAX_GENERATED_CODES;
        code.tries = EmailVerificationCode.MAX_TRIES;
        code.expiresAt = new Date(Date.now() - 60 * 60 * 1000);
        await code.save();

        const next = await EmailVerificationCode.createFor(user, user.email);
        expect(next.code).not.toBe(code.code);
        expect(next.generatedCount).toBe(1);
        expect(next.tries).toBe(0);
    });
});
