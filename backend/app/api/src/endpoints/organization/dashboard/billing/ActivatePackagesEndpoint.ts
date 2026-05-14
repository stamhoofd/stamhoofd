import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, Organization, Platform, STPackage } from '@stamhoofd/models';
import { BalanceItemStatus, BalanceItemType, CheckoutResponse, OrganizationPackagesStatus, PackageCheckout, PaymentStatus, STPackageStruct } from '@stamhoofd/structures';
import { AuthenticatedStructures } from '../../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../../helpers/Context.js';
import { PaymentService } from '../../../../services/PaymentService.js';
import { STPackageService } from '../../../../services/STPackageService.js';
import { CreateMandateSettings } from '@stamhoofd/structures/checkout/CreateMandateSettings.js';
import { PaymentMandateService } from '../../../../services/PaymentMandateService.js';
import { PaymentMandateStatus } from '@stamhoofd/structures/PaymentMandate.js';

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
                    message: $t(`%w1`),
                });
            }
        }


        const packages: STPackageStruct[] = [];
        const balanceItems: Map<BalanceItem, number> = new Map();
        const models: STPackage[] = [];

        if (STAMHOOFD.userMode === 'organization') {
            const currentPackages = await STPackageService.getActivePackages(organization.id);
            const packageStatus = OrganizationPackagesStatus.create({
                packages: currentPackages.map(p => STPackageStruct.create(p)),
            });

            packages.push(...checkout.purchases.getPackages(packageStatus));
        }

        const membershipOrganizationId = (await Platform.getShared()).membershipOrganizationId;
        if (!membershipOrganizationId) {
            throw new SimpleError({
                code: 'unavailable',
                message: 'No membership organization id set on the platform',
                human: $t('De aankoop van pakketten is tijdelijk onbeschikbaar, probeer zo meteen opnieuw en herlaad de pagina.')
            });
        }

        if (membershipOrganizationId === organization.id) {
            throw new SimpleError({
                code: 'unavailable',
                message: 'Cannot purchase packages from yourself',
            });
        }

        const membershipOrganization = await Organization.getByID(membershipOrganizationId);
        if (!membershipOrganization) {
            throw new Error('Unexpected missing membershipOrganization');
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

            if (request.body.proForma) {
                // Security addition
                model.disableSave();
            }

            const balanceItem = await STPackageService.chargePackage(model, undefined, checkout.customer ?? undefined);
            if (balanceItem) {
                balanceItem.VATExcempt = PaymentService.getVATExcempt({
                    customer: checkout.customer,
                    sellingOrganization: membershipOrganization
                });
                balanceItems.set(balanceItem, balanceItem.priceWithVAT);
            }

            if (!request.body.proForma) {
                await model.save();
                await balanceItem?.save();
            } else {
                // Security addition
                if (balanceItem && balanceItem.id) {
                    throw new Error('Unexpected balance item save')
                }
                balanceItem?.disableSave()
            }

            models.push(model);

            if (!checkout.proForma && model.meta.requiresMandate) {
                // setting checkout.mandate is not enough - we also need to set it as default.

                if (!checkout.createMandate) {
                    throw new SimpleError({
                        code: '',
                        message: $t('Je moet de betaalkaart opslaan om dit pakket te activeren. Dit pakket vereist namelijk periodieke betalingen.')
                    })
                }

                if (!checkout.createMandate.saveAsDefault) {
                    throw new SimpleError({
                        code: '',
                        message: $t('Het is noodzakelijk om deze betaalkaart als standaard betaalkaart in te stellen. Dit pakket vereist namelijk periodieke betalingen.')
                    })
                }
            }
        }

        // todo: Add pending items (balance items in request)

        // If still zero payment
        const { price: totalPrice, roundingAmount } = PaymentService.calculateTotalPrice({ 
            balanceItems, 
            organization: membershipOrganization
        })
        const minimumAmount = 2_00;
        
        if (totalPrice < minimumAmount && checkout.createMandate) {
            const item = new BalanceItem();
            item.type = BalanceItemType.AdministrationFee;
            item.description = $t('Verificatie bankkaart of bankrekening')
            item.payingOrganizationId = organization.id;
            item.organizationId = membershipOrganizationId;
            item.VATPercentage = 21;
            item.VATExcempt = PaymentService.getVATExcempt({
                customer: checkout.customer,
                sellingOrganization: membershipOrganization
            });
            item.VATIncluded = !item.VATExcempt; // Makes sure price with VAT always matches unitPrice
            item.quantity = 1;
            item.unitPrice = minimumAmount - (totalPrice - roundingAmount); 
            item.createdAt = new Date();
            item.status = BalanceItemStatus.Hidden;

            if (!request.body.proForma) {
                await item.save();
            } else {
                item.disableSave()
            }

            balanceItems.set(item, item.priceWithVAT);
        }

        if (checkout.proForma) {
            const result = await PaymentService.createProForma({
                balanceItems,
                checkout,
                user,
                organization: membershipOrganization,
                payingOrganization: organization,
            });

            return new Response(CheckoutResponse.create({
                payment: result.payment,
                invoice: result.invoice
            }));
        } 

        const result = await PaymentService.createPayment({
            balanceItems,
            checkout,
            user,
            organization: membershipOrganization,
            payingOrganization: organization,
            serviceFeeType: 'system',
            createMandate: checkout.createMandate,
            useMandate: checkout.mandate,
            paymentConfiguration: membershipOrganization.meta.registrationPaymentConfiguration,
            privatePaymentConfiguration: organization.privateMeta.registrationPaymentConfiguration
        });

        if (!result) {
            // No payment needed
            throw new SimpleError({
                code: 'missing_data',
                message: 'Checkout was empty',
                human: $t('%1L2'),
            });
        }

        for (const pack of models) {
            await pack.save();
        }

        const { payment, paymentUrl, paymentQRCode } = result;

        return new Response(CheckoutResponse.create({
            payment: payment ? await AuthenticatedStructures.paymentGeneral(payment) : null,
            paymentUrl,
            paymentQRCode,
        }));
    }

    setPayment
}
