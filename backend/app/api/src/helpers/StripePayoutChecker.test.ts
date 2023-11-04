import { StripePayoutChecker } from "./StripePayoutChecker";

describe('StripePayoutChecker', () => {
    const checker = new StripePayoutChecker({
        secretKey: STAMHOOFD.STRIPE_SECRET_KEY,
        stripeAccount: 'acct_1MURNPRVn83xywRI'
    });

    it('should list all paouts', async () => {
        await checker.checkSettlements(true);
        expect(true).toBe(true);
    }, 60 * 60000);
});