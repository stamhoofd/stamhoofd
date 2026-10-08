import { Database } from '@simonbackx/simple-database';
import { isXlsxTransformerConcreteColumn } from '@stamhoofd/excel-writer';
import type { Organization, Webshop } from '@stamhoofd/models';
import { OrganizationFactory, UserFactory, WebshopDiscountCode, WebshopFactory } from '@stamhoofd/models';
import type { IPaginatedResponse, PrivateDiscountCode } from '@stamhoofd/structures';
import { ExcelExportType, LimitedFilteredRequest, PermissionLevel, Permissions, PermissionsResourceType, Platform, ResourcePermissions, SortItemDirection } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';

import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint.js';
import { ContextInstance } from '../helpers/Context.js';
import './webshop-discount-codes.js';

describe('ExcelLoader.WebshopDiscountCodes', () => {
    let organization: Organization;
    let webshop: Webshop;

    const loader = () => ExportToExcelEndpoint.loaders.get(ExcelExportType.WebshopDiscountCodes)!;

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
        await Database.delete('DELETE FROM `webshop_discount_codes`');

        organization = await new OrganizationFactory({}).create();
        webshop = await new WebshopFactory({ organizationId: organization.id }).create();
    });

    async function createDiscountCode(data: { code: string; email?: string | null; description?: string; maximumUsage?: number | null; webshop?: Webshop }) {
        const model = new WebshopDiscountCode();
        model.organizationId = (data.webshop ?? webshop).organizationId;
        model.webshopId = (data.webshop ?? webshop).id;
        model.code = data.code;
        model.email = data.email ?? null;
        model.description = data.description ?? '';
        model.maximumUsage = data.maximumUsage ?? null;
        await model.save();
        return model;
    }

    function getColumnValue(row: PrivateDiscountCode, columnId: string) {
        const column = loader().getSheets(Platform.create({}))[0].columns.find(c => isXlsxTransformerConcreteColumn(c) && c.id === columnId);
        if (!column || !isXlsxTransformerConcreteColumn(column)) {
            throw new Error('Column ' + columnId + ' not found');
        }
        return column.getValue(row).value;
    }

    test('exports code, email, description and maximum usage of the managed webshops only', async () => {
        await createDiscountCode({ code: 'SPONSOR', email: 'sponsor@example.com', description: 'Hoofdsponsor', maximumUsage: 5 });
        await createDiscountCode({ code: 'OPEN', email: null, maximumUsage: null });

        const otherWebshop = await new WebshopFactory({ organizationId: organization.id }).create();
        await createDiscountCode({ code: 'NOT-MANAGED', webshop: otherWebshop });

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
        const request = new LimitedFilteredRequest({
            filter: { webshopId: { $in: [webshop.id, otherWebshop.id] } },
            limit: 10,
            sort: [{ key: 'code', order: SortItemDirection.ASC }],
        });
        const response = await ContextInstance.startForUser(user, organization, () => loader().fetch(request));
        const results = response.results as PrivateDiscountCode[];
        expect(results.map(code => code.code)).toEqual(['OPEN', 'SPONSOR']);

        const [open, sponsor] = results;
        expect(getColumnValue(sponsor, 'code')).toBe('SPONSOR');
        expect(getColumnValue(sponsor, 'email')).toBe('sponsor@example.com');
        expect(getColumnValue(sponsor, 'description')).toBe('Hoofdsponsor');
        expect(getColumnValue(sponsor, 'maximumUsage')).toBe(5);

        // Empty cells import back as "no email" and "unlimited"
        expect(getColumnValue(open, 'email')).toBe('');
        expect(getColumnValue(open, 'maximumUsage')).toBe('');

        // Following pages keep the scoping and repeat nothing
        const seen: string[] = [];
        let next: LimitedFilteredRequest | undefined = new LimitedFilteredRequest({
            filter: { webshopId: { $in: [webshop.id, otherWebshop.id] } },
            limit: 1,
            sort: [{ key: 'code', order: SortItemDirection.ASC }],
        });
        while (next) {
            const current = next;
            const page: IPaginatedResponse<unknown[], LimitedFilteredRequest> = await ContextInstance.startForUser(user, organization, () => loader().fetch(current));
            seen.push(...(page.results as PrivateDiscountCode[]).map(code => code.code));
            next = page.next;
        }
        expect(seen).toEqual(['OPEN', 'SPONSOR']);
    });
});
