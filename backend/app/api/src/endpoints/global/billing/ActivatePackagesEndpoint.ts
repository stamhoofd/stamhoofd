import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, Organization, Platform, STPackage } from '@stamhoofd/models';
import { CheckoutResponse, PackageCheckout, Payment as PaymentStruct, STPackageBundleHelper, STPackageStruct } from '@stamhoofd/structures';
import { Context } from '../../../helpers/Context.js';
import { PaymentService } from '../../../services/PaymentService.js';
import { STPackageService } from '../../../services/STPackageService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = PackageCheckout;
type ResponseBody = CheckoutResponse;

export class ActivatePackagesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = PackageCheckout as Decoder<Body>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != 'POST') {
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
        const checkout = request.body;

        // Validate company
        if (checkout.customer && checkout.customer.company) {
            // Search company id
            // this avoids needing to check the VAT number every time
            const id = checkout.customer.company.id;
            const foundCompany = organization.meta.companies.find(c => c.id === id);

            if (!foundCompany) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: $t(`0ab71307-8f4f-4701-b120-b552a1b6bdd0`),
                });
            }
        }

        const currentPackages = await STPackageService.getActivePackages(organization.id);

        const packages: STPackageStruct[] = [];
        const balanceItems: Map<BalanceItem, number> = new Map();
        const models: STPackage[] = [];
        let totalPrice = 0;

        if (STAMHOOFD.userMode === 'organization') {
            // Only allowed in organization mode
            for (const bundle of request.body.purchases.packageBundles) {
            // Renew after currently running packages
                let date = new Date();

                let skip = false;

                // Do we have a collision? Make sure our package only start after the expiry date of existing packages
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
                packages.push(STPackageBundleHelper.getCurrentPackage(bundle, date));
            }

            // Add renewals
            if (checkout.purchases.renewPackageIds.length > 0) {
                for (const id of checkout.purchases.renewPackageIds) {
                    const pack = currentPackages.find(c => c.id === id);
                    if (!pack) {
                        throw new SimpleError({
                            code: 'not_found',
                            message: 'Package not found',
                            human: $t('Het pakket dat je wil verlengen kan je helaas niet meer verlengen'),
                        });
                    }

                    // Renew
                    const model = pack.createRenewed();

                    const balanceItem = await STPackageService.chargePackage(model, undefined, checkout.customer ?? undefined);
                    if (balanceItem) {
                        totalPrice += balanceItem.priceWithVAT;
                        balanceItems.set(balanceItem, balanceItem.priceWithVAT);
                    }

                    if (!request.body.proForma) {
                        await model.save();
                        await balanceItem?.save();
                    }
                    models.push(model);
                }
            }
        }

        // Create the real models for each package
        // calculate the price for these packages and create a hidden balance item
        for (const pack of packages) {
            const model = new STPackage();
            model.id = pack.id;
            model.meta = pack.meta;
            model.validUntil = pack.validUntil;
            model.removeAt = pack.removeAt;

            // Not yet valid / active (ignored until valid)
            model.validAt = null;
            model.organizationId = organization.id;

            const balanceItem = await STPackageService.chargePackage(model, undefined, checkout.customer ?? undefined);
            if (balanceItem) {
                totalPrice += balanceItem.priceWithVAT;
                balanceItems.set(balanceItem, balanceItem.priceWithVAT);
            }

            if (!request.body.proForma) {
                await model.save();
                await balanceItem?.save();
            }

            models.push(model);
        }

        // todo: Add pending items (balance items in request)

        const membershipOrganizationId = (await Platform.getShared()).membershipOrganizationId;
        if (!membershipOrganizationId) {
            throw new SimpleError({
                code: 'unavailable',
                message: 'No membership organization id set on the platform',
                human: 'Package purchases are currently unavailable',
            });
        }

        const membershipOrganization = await Organization.getByID(membershipOrganizationId);
        if (!membershipOrganization) {
            throw new Error('Unexpected missing membershipOrganization');
        }

        const result = await PaymentService.createPayment({
            balanceItems,
            checkout,
            user,
            organization: membershipOrganization,
            payingOrganization: organization,
            serviceFeeType: 'system',
        });

        console.log('Created payment', result);

        if (!result) {
            // No payment needed
            throw new SimpleError({
                code: 'missing_data',
                message: 'Checkout was empty',
                human: $t('Niets om aan te rekenen'),
            });
        }

        if (!checkout.proForma) {
            for (const pack of models) {
                await pack.save();
            }
        }
        else {
            // Delete payment again
            if (result) {
                await result.payment.delete();
                result.paymentUrl = null;
                result.paymentQRCode = null;
            }

            for (const [item] of balanceItems) {
                await item.delete();
            }
        }

        const { payment, paymentUrl, paymentQRCode } = result;

        return new Response(CheckoutResponse.create({
            payment: payment ? PaymentStruct.create(payment) : null,
            paymentUrl,
            paymentQRCode,
        }));
    }
}
