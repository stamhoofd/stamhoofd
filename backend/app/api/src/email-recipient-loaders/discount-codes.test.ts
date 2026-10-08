import { Database } from '@simonbackx/simple-database';
import type { Organization, Webshop } from '@stamhoofd/models';
import { Email, OrganizationFactory, UserFactory, WebshopDiscountCode, WebshopFactory } from '@stamhoofd/models';
import type { EmailRecipient, PaginatedResponse } from '@stamhoofd/structures';
import { LimitedFilteredRequest, PermissionLevel, Permissions, PermissionsResourceType, ResourcePermissions, SortItemDirection } from '@stamhoofd/structures';
import { EmailRecipientFilterType } from '@stamhoofd/structures/email/EmailRecipientFilterType.js';
import { TestUtils } from '@stamhoofd/test-utils';

import './discount-codes.js';
import { ContextInstance } from '../helpers/Context.js';

describe('EmailRecipientLoader.WebshopDiscountCodes', () => {
    let organization: Organization;
    let webshop: Webshop;

    const loader = () => Email.recipientLoaders.get(EmailRecipientFilterType.WebshopDiscountCodes)!;

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
        await Database.delete('DELETE FROM `webshop_discount_codes`');

        organization = await new OrganizationFactory({}).create();
        webshop = await new WebshopFactory({ organizationId: organization.id, name: 'Discount codes test webshop' }).create();
    });

    async function createDiscountCode(data: { code: string; email: string | null; webshop?: Webshop }) {
        const model = new WebshopDiscountCode();
        model.organizationId = (data.webshop ?? webshop).organizationId;
        model.webshopId = (data.webshop ?? webshop).id;
        model.code = data.code;
        model.email = data.email;
        await model.save();
        return model;
    }

    function createFullAdmin() {
        return new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();
    }

    function buildRequest(limit = 10) {
        return new LimitedFilteredRequest({
            limit,
            sort: [{ key: 'code', order: SortItemDirection.ASC }],
        });
    }

    test('returns only codes with an email of the organization, with code replacements', async () => {
        const alpha = await createDiscountCode({ code: 'ALPHA', email: 'alpha@example.com' });
        await createDiscountCode({ code: 'NO-EMAIL', email: null });
        await createDiscountCode({ code: 'EMPTY-EMAIL', email: '' });
        const beta = await createDiscountCode({ code: 'BETA', email: 'beta@example.com' });

        const otherOrganization = await new OrganizationFactory({}).create();
        const otherWebshop = await new WebshopFactory({ organizationId: otherOrganization.id }).create();
        await createDiscountCode({ code: 'OTHER-ORGANIZATION', email: 'other@example.com', webshop: otherWebshop });

        const user = await createFullAdmin();

        const total = await ContextInstance.startForUser(user, organization, () => loader().count(buildRequest(), null));
        expect(total).toBe(2);

        const response = await ContextInstance.startForUser(user, organization, () => loader().fetch(buildRequest(), null));
        expect(response.results.map(recipient => recipient.email)).toEqual(['alpha@example.com', 'beta@example.com']);
        expect(response.next).toBeUndefined();

        const alphaRecipient = response.results.find(recipient => recipient.objectId === alpha.id)!;
        expect(alphaRecipient.replacements).toEqual(expect.arrayContaining([
            expect.objectContaining({ token: 'discountCode', value: 'ALPHA' }),
            expect.objectContaining({ token: 'discountUrl', value: expect.stringContaining('/code/ALPHA') }),
            expect.objectContaining({ token: 'webshopName', value: webshop.meta.name }),
            expect.objectContaining({ token: 'organizationName', value: organization.name }),
        ]));

        const betaRecipient = response.results.find(recipient => recipient.objectId === beta.id)!;
        expect(betaRecipient.replacements).toEqual(expect.arrayContaining([
            expect.objectContaining({ token: 'discountCode', value: 'BETA' }),
            expect.objectContaining({ token: 'discountUrl', value: expect.stringContaining('/code/BETA') }),
        ]));
    });

    test('follows next pages without repeating recipients', async () => {
        for (const code of ['A', 'B', 'C']) {
            await createDiscountCode({ code, email: `${code.toLowerCase()}@example.com` });
            await createDiscountCode({ code: code + '-NO-EMAIL', email: null });
        }
        const user = await createFullAdmin();

        const seen: string[] = [];
        let next: LimitedFilteredRequest | undefined = buildRequest(1);
        while (next) {
            const request = next;
            const page: PaginatedResponse<EmailRecipient[], LimitedFilteredRequest> = await ContextInstance.startForUser(user, organization, () => loader().fetch(request, null));
            seen.push(...page.results.map(recipient => recipient.email!));
            next = page.next;
        }

        expect(seen).toEqual(['a@example.com', 'b@example.com', 'c@example.com']);
    });

    test('only includes codes of webshops the user fully manages', async () => {
        const otherWebshop = await new WebshopFactory({ organizationId: organization.id }).create();
        await createDiscountCode({ code: 'MANAGED', email: 'managed@example.com' });
        await createDiscountCode({ code: 'NOT-MANAGED', email: 'not-managed@example.com', webshop: otherWebshop });

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.None,
                resources: new Map([
                    [PermissionsResourceType.Webshops, new Map([
                        [webshop.id, ResourcePermissions.create({ level: PermissionLevel.Full })],
                    ])],
                ]),
            }),
        }).create();

        // The webshop id in the filter is client-supplied, so it must not widen access
        const request = () => new LimitedFilteredRequest({
            filter: { webshopId: { $in: [webshop.id, otherWebshop.id] } },
            limit: 10,
            sort: [{ key: 'code', order: SortItemDirection.ASC }],
        });

        expect(await ContextInstance.startForUser(user, organization, () => loader().count(request(), null))).toBe(1);
        const response = await ContextInstance.startForUser(user, organization, () => loader().fetch(request(), null));
        expect(response.results.map(recipient => recipient.email)).toEqual(['managed@example.com']);
    });
});
