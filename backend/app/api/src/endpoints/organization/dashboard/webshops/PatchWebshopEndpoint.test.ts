import type { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@common/encoding';
import { PatchableArray } from '@common/encoding';
import { Request } from '@node/endpoints';
import { OrganizationFactory, UserFactory, Webshop, WebshopFactory } from '@stamhoofd/models';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { Permissions, PrivateWebshop, Product, RecordCategory, RecordSettings, RecordType, TranslatedString, WebshopMetaData } from '@stamhoofd/structures';
import { CustomerSettings } from '@stamhoofd/structures/webshops/CustomerSettings.js';
import { Language } from '@stamhoofd/types/Language';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { SessionService } from '../../../../services/SessionService.js';

import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { PatchWebshopEndpoint } from './PatchWebshopEndpoint.js';

describe('Endpoint.PatchWebshop', () => {
    const endpoint = new PatchWebshopEndpoint();

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    async function createAdminContext(options?: {
        isStamhoofd?: boolean;
    }) {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization,
            isStamhoofd: options?.isStamhoofd ?? false,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();
        const token = await SessionService.createSession(user);

        return { organization, token };
    }
    type AdminContext = Awaited<ReturnType<typeof createAdminContext>>;

    test('defaultLanguage can be updated', async () => {
        const { organization, token } = await createAdminContext();
        const webshop = await new WebshopFactory({ organizationId: organization.id }).create();

        const patch = PrivateWebshop.patch({
            meta: WebshopMetaData.patch({
                defaultLanguage: Language.French,
            }),
        });
        const request = Request.buildJson('PATCH', '/webshop/' + webshop.id, organization.getApiHost(), patch);
        request.headers.authorization = 'Bearer ' + token.accessToken;

        const response = await testServer.test(endpoint, request);
        expect(response.body.meta.defaultLanguage).toBe(Language.French);

        // Persisted in the database
        const reloaded = await Webshop.getByID(webshop.id);
        expect(reloaded?.meta.defaultLanguage).toBe(Language.French);
    });

    describe('meta', () => {
        test('meta.noServiceFee can be set by @stamhoofd.be user', async () => {
            const { organization, token } = await createAdminContext({
                isStamhoofd: true,
            });
            const webshop = await new WebshopFactory({ organizationId: organization.id }).create();

            const patch = PrivateWebshop.patch({
                meta: WebshopMetaData.patch({
                    noServiceFees: true,
                }),
            });
            const request = Request.buildJson('PATCH', '/webshop/' + webshop.id, organization.getApiHost(), patch);
            request.headers.authorization = 'Bearer ' + token.accessToken;

            const response = await testServer.test(endpoint, request);
            expect(response.body.meta.noServiceFees).toBe(true);

            // Persisted in the database
            const reloaded = await Webshop.getByID(webshop.id);
            expect(reloaded?.meta.noServiceFees).toBe(true);
        });

        test('meta.noServiceFee can\'t be set by non-@stamhoofd.be user', async () => {
            const { organization, token } = await createAdminContext();
            const webshop = await new WebshopFactory({ organizationId: organization.id }).create();

            const patch = PrivateWebshop.patch({
                meta: WebshopMetaData.patch({
                    noServiceFees: true,
                }),
            });
            const request = Request.buildJson('PATCH', '/webshop/' + webshop.id, organization.getApiHost(), patch);
            request.headers.authorization = 'Bearer ' + token.accessToken;

            await expect(testServer.test(endpoint, request)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));

            // Persisted in the database
            const reloaded = await Webshop.getByID(webshop.id);
            expect(reloaded?.meta.noServiceFees).not.toBe(true);
        });
    });

    describe('meta.customerSettings.recordCategory', () => {
        async function createWebshopWithCustomerQuestion() {
            const { organization, token } = await createAdminContext();
            const question = RecordSettings.create({ name: TranslatedString.create('Opmerking'), type: RecordType.Text });
            const category = RecordCategory.create({ name: TranslatedString.create('Extra vragen'), records: [question] });
            const webshop = await new WebshopFactory({
                organizationId: organization.id,
                meta: WebshopMetaData.patch({
                    customerSettings: CustomerSettings.create({ recordCategory: category }),
                }),
            }).create();
            return { organization, token, webshop, category, question };
        }

        async function patchCustomerSettings(context: Pick<AdminContext, 'organization' | 'token'> & { webshop: Webshop }, customerSettings: CustomerSettings | AutoEncoderPatchType<CustomerSettings>) {
            const patch = PrivateWebshop.patch({
                meta: WebshopMetaData.patch({ customerSettings }),
            });
            const request = Request.buildJson('PATCH', '/webshop/' + context.webshop.id, context.organization.getApiHost(), patch);
            request.headers.authorization = 'Bearer ' + context.token.accessToken;
            return testServer.test(endpoint, request);
        }

        function recordsPatch(question: RecordSettings, type: RecordType): PatchableArrayAutoEncoder<RecordSettings> {
            const records: PatchableArrayAutoEncoder<RecordSettings> = new PatchableArray();
            records.addPatch(RecordSettings.patch({ id: question.id, type }));
            return records;
        }

        test('rejects an incompatible type change of a saved question sent as a patch', async () => {
            const context = await createWebshopWithCustomerQuestion();

            await expect(patchCustomerSettings(context, CustomerSettings.patch({
                recordCategory: RecordCategory.patch({ id: context.category.id, records: recordsPatch(context.question, RecordType.Checkbox) }),
            }))).rejects.toThrow(STExpect.errorWithCode('invalid_record_type'));

            const reloaded = await Webshop.getByID(context.webshop.id);
            expect(reloaded?.meta.customerSettings.recordCategory?.records[0].type).toBe(RecordType.Text);
        });

        test('rejects an incompatible type change of a saved question sent as a put', async () => {
            const context = await createWebshopWithCustomerQuestion();
            const changed = context.category.patch({ records: recordsPatch(context.question, RecordType.Checkbox) });

            await expect(patchCustomerSettings(context, CustomerSettings.patch({
                recordCategory: changed,
            }))).rejects.toThrow(STExpect.errorWithCode('invalid_record_type'));

            const reloaded = await Webshop.getByID(context.webshop.id);
            expect(reloaded?.meta.customerSettings.recordCategory?.records[0].type).toBe(RecordType.Text);
        });

        test('allows a compatible type change of a saved question', async () => {
            const context = await createWebshopWithCustomerQuestion();

            const response = await patchCustomerSettings(context, CustomerSettings.patch({
                recordCategory: RecordCategory.patch({ id: context.category.id, records: recordsPatch(context.question, RecordType.Textarea) }),
            }));
            expect(response.body.meta.customerSettings.recordCategory?.records[0].type).toBe(RecordType.Textarea);

            const reloaded = await Webshop.getByID(context.webshop.id);
            expect(reloaded?.meta.customerSettings.recordCategory?.records[0].type).toBe(RecordType.Textarea);
        });

        test('rejects an incompatible type change of a saved question of a product', async () => {
            const { organization, token } = await createAdminContext();
            const question = RecordSettings.create({ name: TranslatedString.create('Allergieën'), type: RecordType.Text });
            const category = RecordCategory.create({ name: TranslatedString.create('Extra vragen'), records: [question] });
            const product = Product.create({ name: 'Deelname', enableCustomer: true, customerSettings: CustomerSettings.create({ recordCategory: category }) });
            const webshop = await new WebshopFactory({ organizationId: organization.id, products: [product] }).create();

            const products: PatchableArrayAutoEncoder<Product> = new PatchableArray();
            products.addPatch(Product.patch({
                id: product.id,
                customerSettings: CustomerSettings.patch({
                    recordCategory: RecordCategory.patch({ id: category.id, records: recordsPatch(question, RecordType.Checkbox) }),
                }),
            }));
            const request = Request.buildJson('PATCH', '/webshop/' + webshop.id, organization.getApiHost(), PrivateWebshop.patch({ products }));
            request.headers.authorization = 'Bearer ' + token.accessToken;

            await expect(testServer.test(endpoint, request)).rejects.toThrow(STExpect.errorWithCode('invalid_record_type'));

            const reloaded = await Webshop.getByID(webshop.id);
            expect(reloaded?.products[0].customerSettings?.recordCategory?.records[0].type).toBe(RecordType.Text);
        });

        test('allows creating the category when the webshop has none yet', async () => {
            const { organization, token } = await createAdminContext();
            const webshop = await new WebshopFactory({ organizationId: organization.id }).create();
            const question = RecordSettings.create({ name: TranslatedString.create('Opmerking'), type: RecordType.Checkbox });
            const category = RecordCategory.create({ name: TranslatedString.create('Extra vragen'), records: [question] });

            const response = await patchCustomerSettings({ organization, token, webshop }, CustomerSettings.patch({ recordCategory: category }));
            expect(response.body.meta.customerSettings.recordCategory?.records.map(r => r.id)).toEqual([question.id]);

            const reloaded = await Webshop.getByID(webshop.id);
            expect(reloaded?.meta.customerSettings.recordCategory?.records[0].type).toBe(RecordType.Checkbox);
        });
    });
});
