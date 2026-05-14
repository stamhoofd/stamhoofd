import type { Mandate , Payment as MolliePaymentType} from '@mollie/api-client';
import { ApiMode, createMollieClient, MandateMethod, MandateStatus, PaymentMethod as molliePaymentMethod, PaymentStatus as molliePaymentStatus, OnboardingStatus, ProfileStatus, SequenceType } from '@mollie/api-client';
import { SimpleError } from '@simonbackx/simple-errors';
import type { Payment, User } from '@stamhoofd/models';
import { Organization } from '@stamhoofd/models';
import { MolliePayment, MollieToken, Platform } from '@stamhoofd/models';
import type { PaymentCustomer } from '@stamhoofd/structures';
import { MollieOnboarding, MollieProfile, MollieProfileMode, MollieProfileStatus, MollieStatus, PaymentMethod, PaymentMethodHelper, PaymentProvider, PaymentStatus } from '@stamhoofd/structures';
import { PaymentMandate, PaymentMandateDetails, PaymentMandateStatus, PaymentMandateType } from '@stamhoofd/structures/PaymentMandate.js';
import { Formatter } from '@stamhoofd/utility';
import { DateTime } from 'luxon';
import { Context } from '../helpers/Context.js';

export class MollieService {
    client: ReturnType<typeof createMollieClient>;
    sellingOrganization: Organization;
    createdAt: Date

    private constructor({sellingOrganization, accessToken}: {sellingOrganization: Organization, accessToken: string}) {
        this.sellingOrganization = sellingOrganization
        this.client = createMollieClient({ accessToken });
        this.createdAt = new Date()
    }

    static #cachedServices: Map<string, MollieService> = new Map()

    /**
     * Cached instances can be used for maximum 30 seconds
     */
    isOutdated() {
        return this.createdAt.getTime() < Date.now() - 30_000
    }

    static async create({sellingOrganization}: {sellingOrganization: Organization}) {
        const cached = this.#cachedServices.get(sellingOrganization.id);
        if (cached && !cached.isOutdated()) {
            return cached;
        }
        const token = await MollieToken.getTokenFor(sellingOrganization.id);
        if (!token) {
            if (cached) {
                this.#cachedServices.delete(sellingOrganization.id)
            }
            return null;
        }
        const service = new MollieService({ sellingOrganization, accessToken: await token.getAccessToken() });
        this.#cachedServices.set(sellingOrganization.id, service);
        return service;
    }
    
    /**
     * Set initial onboarding values + enable bancontact
     */
    async setupOnboarding() {
        // Submit onboarding data
        this.sellingOrganization.privateMeta.mollieOnboarding = await this.getOnboardingStatus();

        if (this.sellingOrganization.privateMeta.mollieOnboarding && this.sellingOrganization.privateMeta.mollieOnboarding.status === MollieStatus.NeedsData) {
            try {
                await this.client.onboarding.submit({
                    organization: {
                        name: this.sellingOrganization.name,
                        address: {
                            streetAndNumber: this.sellingOrganization.address.street + ' ' + this.sellingOrganization.address.number,
                            postalCode: this.sellingOrganization.address.postalCode,
                            city: this.sellingOrganization.address.city,
                            country: this.sellingOrganization.address.country,
                        },

                        vatRegulation: 'shifted',
                    },
                    profile: {
                        name: this.sellingOrganization.name + ' via Stamhoofd',
                        description: $t(`%x1`),
                        categoryCode: 8398,
                    },
                })
            } catch (e) {
                console.error('Failed to submit onboarding data', e);
            }
        }
    }

    #verifiedCustomerIds: Set<string> = new Set()

    /**
     * Gets the customer id for a given payingOrganization or user.
     * If no customer exists, it will create a new mollie customer if customer (payment customer) is set as parameter
     */
    async getCustomerId({ payingOrganization, user, customer }: { 
        payingOrganization: Organization | null, 
        user: User | null,

        /**
         * Required to be able to create a new customer
         */
        customer?: PaymentCustomer
    }): Promise<string | null> {
        if (!payingOrganization) {
            // Not yet supported for users
            return null;
        }

        if (this.sellingOrganization.id !== (await Platform.getShared()).membershipOrganizationId) {
            // Not yet supported
            return null;
        }


        if (payingOrganization.serverMeta.mollieCustomerId) {
            const customerId = payingOrganization.serverMeta.mollieCustomerId
            if (this.#verifiedCustomerIds.has(customerId)) {
                return customerId;
            }

            // check still valid
            try {
                const c = await this.client.customers.get(customerId, {testmode: this.testMode});

                if ((c.mode === ApiMode.test) === this.testMode) {
                    this.#verifiedCustomerIds.add(customerId);
                    return customerId;
                }
            } catch (e) {
                console.error('Error getting customer', e)
                // Customer is not valid anymore, we need to create a new one
            }
        }

        if (!customer) {
            // No existing customer exists
            // won't create a new one if customer is not set
            return null;
        }

        const mollieCustomer = await this.client.customers.create({
            name: payingOrganization.name,
            email: customer.email ?? undefined,
            metadata: {
                organizationId: payingOrganization.id,
                userId: user?.id,
            },
            testmode: this.testMode
        })

        const customerId = mollieCustomer.id
        this.#verifiedCustomerIds.add(customerId);

        payingOrganization.serverMeta.mollieCustomerId = mollieCustomer.id
        console.log('Saving new mollie customer', mollieCustomer, 'for organization', payingOrganization.id)
        await payingOrganization.save()
        
        return customerId
    }

    #cachedMandates: Map<string, PaymentMandate[]> = new Map()

    async getMandates({ payingOrganization, user }: { 
        payingOrganization: Organization | null, 
        user: User | null,
    }): Promise<PaymentMandate[]> {
        const customerId = await this.getCustomerId({payingOrganization, user});
        if (!customerId) {
            return [];
        }

        const cached = this.#cachedMandates.get(customerId);
        if (cached) {
            //return cached;
        }

        // Poll mollie status
        // Mollie payment is required
        const mandates: PaymentMandate[] = []

        try {
            const m = await this.client.customerMandates.page({ 
                customerId, 
                limit: 250,
                testmode: this.testMode
            })

            for (const mandate of m) {
                const paymentMandate = MollieService.mollieManateToStamhoofd({mandate, payingOrganization, user});
                if (paymentMandate) {
                    mandates.push(paymentMandate)
                }
            }
        } catch (e) {
            console.error(e)
        }

        // todo: remove duplicate mandates?
        return mandates;
    }

    async deleteMandate({ mandateId, payingOrganization, user }: { 
        mandateId: string,
        payingOrganization: Organization | null, 
        user: User | null,
    }) {
        const customerId = await this.getCustomerId({payingOrganization, user});
        if (!customerId) {
            return
        }

        await this.client.customerMandates.revoke(
            mandateId,
            {
                customerId,
                testmode: this.testMode
            }
        )
    }

    private static mollieManateToStamhoofd({ mandate, payingOrganization, user }: { 
        mandate: Mandate,
        payingOrganization: Organization | null, 
        user: User | null,
    }): PaymentMandate | null {
        let type: PaymentMandateType;
        switch (mandate.method) {
            case MandateMethod.creditcard: {
                type = PaymentMandateType.CreditCard
                break;
            }

            case MandateMethod.directdebit: {
                type = PaymentMandateType.DirectDebit
                break;
            }

            default: {
                // Not supported
                return null;
            }
        }
        const details = mandate.details;
        return PaymentMandate.create({
            id: mandate.id,
            status: MollieService.mollieMandateStatusToStamhoofd(mandate),

            // Todo: support for user default mandates
            isDefault: mandate.id === payingOrganization?.serverMeta.mollieMandateId,

            createdAt: new Date(mandate.createdAt),

            provider: PaymentProvider.Mollie,

            type,

            details: PaymentMandateDetails.create({
                name: ('consumerName' in details ? details.consumerName : details.cardHolder) ?? undefined,
                cardNumber: 'cardNumber' in details ? details.cardNumber : null,
                iban: 'consumerAccount' in details ? details.consumerAccount : null,
                bic: ('consumerBic' in details ? details.consumerBic : undefined),
                expiryDate: ('cardExpiryDate' in details ? DateTime.fromISO(details.cardExpiryDate, {zone: Formatter.timezone}).toJSDate() : null), // todo: parse date correctly in Brussels timezone!
                brand: ('cardLabel' in details ? details.cardLabel : null),
            })
        })
    }

    private static mollieMandateStatusToStamhoofd(mandate: Mandate): PaymentMandateStatus {
        switch (mandate.status) {
            case MandateStatus.valid: {
                return PaymentMandateStatus.Valid
            }
            case MandateStatus.invalid: {
                return PaymentMandateStatus.Invalid
            }
            case MandateStatus.pending: {
                return PaymentMandateStatus.Pending
            }
        }
    }

    private static paymentMethodToMollie(method: PaymentMethod) {
        switch (method) {
            case PaymentMethod.Bancontact:
                return molliePaymentMethod.bancontact
            case PaymentMethod.CreditCard:
                return molliePaymentMethod.creditcard
            case PaymentMethod.DirectDebit:
                return molliePaymentMethod.directdebit
            case PaymentMethod.iDEAL:
                return molliePaymentMethod.ideal
            case PaymentMethod.Transfer:
                return molliePaymentMethod.banktransfer
        }

        return null;
    }

    async getProfiles(): Promise<MollieProfile[]> {
        try {
            const response = await this.client.profiles.page({
                limit: 250
            })
            return response.map(p => MollieProfile.create({
                ...p,
                mode: p.mode === ApiMode.live ? MollieProfileMode.Live : MollieProfileMode.Test,
                status: p.status === ProfileStatus.unverified ? MollieProfileStatus.Unverified : (p.status === ProfileStatus.blocked ? MollieProfileStatus.Blocked : MollieProfileStatus.Verified)
            }));
        }
        catch (e) {
            console.error('Failed to parse mollie profiles', e);
            return [];
        }
    }

    async getOnboardingStatus() {
        try {
            const response = await this.client.onboarding.get();
            return MollieOnboarding.create({
                canReceivePayments: !!response.canReceivePayments,
                canReceiveSettlements: !!response.canReceiveSettlements,
                status: response.status === OnboardingStatus.needsData ? MollieStatus.NeedsData : (response.status === OnboardingStatus.inReview ? MollieStatus.InReview : (MollieStatus.Completed)),
            });
        }
        catch (e) {
            console.error('Error when requesting Mollie onboarding status:');
            console.error(e);
            return null;
        }
    }

    async getProfileId(website?: string): Promise<string | undefined> {
        if (this.sellingOrganization.privateMeta.mollieProfile?.id) {
            return this.sellingOrganization.privateMeta.mollieProfile.id
        }

        try {
            const profiles = await this.client.profiles.page({
                limit: 250,
            })

            // Search profile with Stamhoofd as name
            if (website) {
                for (const profile of profiles) {
                    if (profile.website.toLowerCase().includes(website)) {
                        return profile.id;
                    }
                }
            }

            // Search profile with Stamhoofd as name
            for (const profile of profiles) {
                if (profile.name.toLowerCase().includes('stamhoofd')) {
                    return profile.id;
                }
            }

            return profiles[0]?.id ?? undefined;
        }
        catch (e) {
            console.error('Error when requesting Mollie profile id:');
            console.error(e);
            return undefined;
        }
    }

    get locale() {
        const preferredLocale = Context.i18n.locale.replace('-', '_');
        return ['en_US', 'en_GB', 'nl_NL', 'nl_BE', 'fr_FR', 'fr_BE', 'de_DE', 'de_AT', 'de_CH', 'es_ES', 'ca_ES', 'pt_PT', 'it_IT', 'nb_NO', 'sv_SE', 'fi_FI', 'da_DK', 'is_IS', 'hu_HU', 'pl_PL', 'lv_LV', 'lt_LT'].includes(preferredLocale) ? (preferredLocale as any) : null;
    }

    get testMode() {
        return this.sellingOrganization.privateMeta.useTestPayments ?? STAMHOOFD.environment !== 'production';
    }

    static async createPayment(
        { sellingOrganization, payment, mandate, redirectUrl, webhookUrl, cancelUrl, description, metadata, payingOrganization, user, customer}: {
            payment: Payment;
            mandate: PaymentMandate | null;
            redirectUrl: string;
            cancelUrl: string;
            webhookUrl: string;
            description: string;
            metadata: { [key: string]: string };
            sellingOrganization: Organization,
            payingOrganization: Organization | null,
            user: User | null,
            customer: PaymentCustomer,
        },
    ): Promise<{ paymentUrl: string | null }> {
        const mollieService = await MollieService.create({sellingOrganization});
        const profileId = await mollieService?.getProfileId();                    
        const method = MollieService.paymentMethodToMollie(payment.method);

        if (!mollieService || !profileId || !method) {
            throw new SimpleError({
                code: '',
                message: $t(`%w3`, { method: PaymentMethodHelper.getName(payment.method) }),
            });
        }

        const customerId = await mollieService.getCustomerId({
            payingOrganization: payingOrganization ?? null,
            user,
            customer,
        }) ?? undefined


        const data: Parameters<typeof mollieService.client.payments.create>[0] = {
            amount: {
                currency: 'EUR',
                value: (Math.round(payment.price / 100) / 100).toFixed(2),
            },
            method,
            testmode: mollieService.testMode,
            mandateId: mandate?.id,
            sequenceType: mandate ? SequenceType.recurring : (payment.createMandate ? SequenceType.first : SequenceType.oneoff),
            customerId,
            profileId,
            description,
            redirectUrl,
            cancelUrl,
            webhookUrl,
            metadata: {
                paymentId: payment.id,
                ...metadata
            },
            locale: mollieService.locale,
        };
        console.log('Creating payment', data)
        const molliePayment = await mollieService.client.payments.create(data);
        console.log('Payment response', molliePayment)

        const paymentUrl = molliePayment.getCheckoutUrl();

        // Save payment
        const dbPayment = new MolliePayment();
        dbPayment.paymentId = payment.id;
        dbPayment.mollieId = molliePayment.id;
        await dbPayment.save();

        payment.status = await mollieService.getStatusFor(molliePayment, payment, false)
        
        return {
            paymentUrl: paymentUrl
        }
    }

    static async saveChargeInfo(mollieData: MolliePaymentType, payment: Payment) {
        try {
            const details = mollieData.details;
            if (details) {
                if ('consumerName' in details) {
                    payment.ibanName = details.consumerName;
                }
                if ('consumerAccount' in details) {
                    payment.iban = details.consumerAccount;
                }
                if ('cardHolder' in details) {
                    payment.ibanName = details.cardHolder;
                }
                if ('cardNumber' in details) {
                    payment.iban = '•••• ' + details.cardNumber;
                }
                await payment.save();
            }
        }
        catch (e) {
            console.error('Failed processing charge', e);
        }
    }

    async getStatusFor(mollieData: MolliePaymentType, payment: Payment, cancel = false): Promise<PaymentStatus> {
        await MollieService.saveChargeInfo(mollieData, payment)

        if (mollieData.mandateId && mollieData.status === molliePaymentStatus.paid) {
            if (payment.createMandate && payment.createMandate.saveAsDefault) {
                try {
                    // Set as default
                    if (payment.payingOrganizationId) {
                        const payingOrganization = await Organization.getByID(payment.payingOrganizationId)
                        if (payingOrganization) {
                            console.log('Saving ' + mollieData.mandateId + ' as default mandate for organization ' + payingOrganization.id + ' ' + payingOrganization.name)
                            payingOrganization.serverMeta.mollieMandateId = mollieData.mandateId
                            await payingOrganization.save()
                        }
                    }
                } catch (e) {
                    console.error('Failed to save default mandate for Mollie Payment ' + payment.id, {cause: e})
                }
            }
        }

        if (mollieData.status === molliePaymentStatus.paid) {
            return PaymentStatus.Succeeded
        } else if (mollieData.status === molliePaymentStatus.failed) {
            return PaymentStatus.Failed
        } else if (mollieData.status === molliePaymentStatus.expired) {
            return PaymentStatus.Failed
        } else if (mollieData.status === molliePaymentStatus.canceled) {
            return PaymentStatus.Failed
        }

        // Pending payments should be cancellable
        if (cancel && mollieData.isCancelable) {
            console.log('Cancelling Mollie Payment ' + payment.id);

            // Try to cancel
            try {
                const newData = await this.client.payments.cancel(mollieData.id, {
                    testmode: this.testMode
                });
                console.log('Cancelled Mollie Payment ' + payment.id);
                return await this.getStatusFor(newData, payment, false)
            } catch (e) {
                console.error('Failed to cancel Mollie Payment ' + payment.id, {cause: e})
            }

        } else if (cancel) {
            console.log('Cannot cancel Mollie Payment ' + payment.id);  
        }

        if (mollieData.status === molliePaymentStatus.open ) {
            // Nothink happend yet
            return PaymentStatus.Created
        }

        return PaymentStatus.Pending
    }

    async getStatus(payment: Payment, cancel = false) {
        const molliePayment = await MolliePayment.select().where('paymentId', payment.id).first(false);
        if (!molliePayment) {
            throw new Error('Mollie Payment not found for payment ' + payment.id)
        }

        const mollieData = await this.client.payments.get(molliePayment.mollieId, {
            testmode: this.testMode
        });

        return this.getStatusFor(mollieData, payment, cancel)
    }
}
