import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request } from '@simonbackx/simple-endpoints';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Organization, Platform, Registration, STPackage } from '@stamhoofd/models';
import { CheckoutResponse, Invoice, PackageCheckout, STPackageBundleHelper, STPackage as STPackageStruct, STPricingType } from '@stamhoofd/structures';
import { Context } from '../../../helpers/Context.js';
import { ViesHelper } from '../../../helpers/ViesHelper.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = PackageCheckout;
type ResponseBody = CheckoutResponse;

export class ActivatePackagesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = PackageCheckout as Decoder<Body>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/billing/activate-packages', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        const { user } = await Context.authenticate();

        // If the user has permission, we'll also search if he has access to the organization's key
        if (!await Context.auth.canActivatePackages(organization.id)) {
            throw Context.auth.error();
        }

        if (request.body.customer.company) {
            // Validate VAT info
            try {
                await ViesHelper.checkCompany(request.body.customer.company, request.body.customer.company);
            }
            catch (e) {
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    e.addNamespace('customer.company');
                }
                throw e;
            }
        }

        const platform = await Platform.getShared();
        const sellerOrganization = platform.membershipOrganizationId ? await Organization.getByID(platform.membershipOrganizationId) : undefined;
        if (!sellerOrganization) {
            throw new SimpleError({
                code: 'missing_membership_organization',
                message: 'The platform is not configured correctly to sell packages.',
                human: $t('Dit platform is nog niet correct geconfigureerd om pakketten aan te kopen'),
            });
        }

        const seller = sellerOrganization.meta.companies[0];
        if (!seller) {
            throw new SimpleError({
                code: 'missing_seller_company',
                message: 'The seller has not yet configured its invoice settings.^',
                human: $t('De facturatiegegevens van {oragnization} zijn nog niet ingesteld. Probeer het later opnieuw.'),
            });
        }

        const invoice = Invoice.create({
            seller,
            customer: request.body.customer,
            payingOrganizationId: organization.id,
            organizationId: sellerOrganization.id,
            items: [],
        });

        const currentPackages = await STPackage.getForOrganization(organization.id);
        const models: STPackage[] = [];
        let membersCount: number | null = null; // Cache member count

        // Process packages
        for (const bundle of request.body.purchases.packageBundles) {
            // Fetch date from which we need to renew
            let date = new Date();

            let skip = false;
            // Do we have a collision?
            for (const currentPack of currentPackages) {
                if (!STPackageBundleHelper.isCombineable(bundle, STPackageStruct.create(currentPack))) {
                    if (!STPackageBundleHelper.isStackable(bundle, STPackageStruct.create(currentPack))) {
                        // WE skip silently
                        console.error('Tried to activate non combineable, non stackable packages...');
                        skip = true;
                        continue;
                    }
                    if (currentPack.validUntil !== null) {
                        const end = currentPack.validUntil;
                        if (end > date) {
                            date = end;
                        }
                    }
                }
            }

            if (skip) {
                continue;
            }

            // todo: create (inactive) package
            const pack = STPackageBundleHelper.getCurrentPackage(bundle, date);
            const model = new STPackage();
            model.id = pack.id;
            model.meta = pack.meta;
            model.validUntil = pack.validUntil;
            model.removeAt = pack.removeAt;

            // Not yet valid / active (ignored until valid)
            model.validAt = null;
            model.organizationId = organization.id;

            // If type is
            let amount = 1;

            if (membersCount === null && pack.meta.pricingType === STPricingType.PerMember) {
                membersCount = await Registration.getActiveMembers(organization.id);
            }

            if (pack.meta.pricingType === STPricingType.PerMember) {
                amount = membersCount ?? 1;
            }

            // Add items to invoice
            invoice.items.push(
                STInvoiceItem.fromPackage(pack, amount, 0, date),
            );

            if (!request.body.proForma) {
                await model.save();
            }
            models.push(model);
        }

        for (const id of request.body.purchases.renewPackageIds) {
            const pack = currentPackages.find(c => c.id === id);
            if (!pack) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Package not found',
                    human: 'Het pakket dat je wil verlengen kan je helaas niet meer verlengen',
                });
            }

            // Renew
            const model = pack.createRenewed();

            // If type is
            let amount = 1;

            if (membersCount === null && model.meta.pricingType === STPricingType.PerMember) {
                membersCount = await Registration.getActiveMembers(organization.id);
            }

            if (model.meta.pricingType === STPricingType.PerMember) {
                amount = membersCount ?? 1;
            }

            // Add items to invoice
            invoice.items.push(
                STInvoiceItem.fromPackage(STPackageStruct.create(model), amount, 0, date),
            );

            if (!request.body.proForma) {
                await model.save();
            }
            models.push(model);
        }

        // Todo: add all outstanding balances for this organization

        // Todo: add credits

        // Todo: if not in pro forma mode, create a balance + payment for it

        await invoice.calculatePrices();

        return CheckoutResponse.create({
            invoice,
        });
    }
}
