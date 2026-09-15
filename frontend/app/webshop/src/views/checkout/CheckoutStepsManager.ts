import type { SimpleErrors } from '@simonbackx/simple-errors';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, ReactiveUrl } from '@simonbackx/vue-app-navigation';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import type { Checkout, CheckoutMethod, OrganizationMetaData, PatchAnswers, Webshop } from '@stamhoofd/structures';
import { CheckoutMethodType } from '@stamhoofd/structures';
import { CustomerFieldRequirement } from '@stamhoofd/structures/webshops/CustomerFieldRequirement.js';
import { Formatter } from '@stamhoofd/utility';

import { patchObject } from '@simonbackx/simple-encoding';
import type { CheckoutManager } from '../../classes/CheckoutManager';

export enum CheckoutStepType {
    Method = 'Method',
    Address = 'Address',
    Customer = 'Customer',
    Time = 'Time',
    Payment = 'Payment',
}

export class CheckoutStep {
    id: string;
    active: boolean;
    url: string;
    skipHandler?: () => void;
    getComponent: () => Promise<ComponentWithProperties>;
    validate: (checkout: Checkout, webshop: Webshop, organizationMeta: OrganizationMetaData) => void;

    constructor(data: {
        id: string;
        active?: boolean;
        url: string;
        skipHandler?: () => void;
        getComponent: () => Promise<ComponentWithProperties>;
        validate: (checkout: Checkout, webshop: Webshop, organizationMeta: OrganizationMetaData) => void;
    }) {
        this.id = data.id;
        this.active = data.active ?? true;
        this.skipHandler = data.skipHandler;
        this.getComponent = data.getComponent;
        this.validate = data.validate;
        this.url = data.url;
    }
}

export class CheckoutStepsManager {
    $checkoutManager: CheckoutManager;

    private constructor($checkoutManager: CheckoutManager) {
        this.$checkoutManager = $checkoutManager;
    }

    get $webshopManager() {
        return this.$checkoutManager.$webshopManager;
    }

    get $context() {
        return this.$webshopManager.$context;
    }

    static for($checkoutManager: CheckoutManager) {
        return new CheckoutStepsManager($checkoutManager);
    }

    /// Return all the steps that are confirmed with the current checkout configuration
    getSteps(): CheckoutStep[] {
        const webshop = this.$webshopManager.webshop;
        const checkout = this.$checkoutManager.checkout;
        const checkoutMethod = webshop.meta.checkoutMethods.find(m => m.id === checkout.checkoutMethod?.id) ?? (webshop.meta.checkoutMethods[0] as CheckoutMethod | undefined) ?? null;
        const steps: CheckoutStep[] = [];

        steps.push(
            new CheckoutStep({
                id: CheckoutStepType.Method,
                url: '/checkout/' + CheckoutStepType.Method.toLowerCase(),
                active: webshop.meta.checkoutMethods.length > 1,
                skipHandler: () => {
                    // Skip behaviour
                    // Set to the only available checkout method
                    this.$checkoutManager.checkout.checkoutMethod = this.$webshopManager.webshop.meta.checkoutMethods.length == 0 ? null : this.$webshopManager.webshop.meta.checkoutMethods[0];
                    this.$checkoutManager.saveCheckout();
                },
                getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './CheckoutMethodSelectionView.vue').then(m => new ComponentWithProperties(m.default, {})),
                validate: (checkout, webshop, organizationMeta) => checkout.validateCheckoutMethod(webshop, organizationMeta),
            }),
        );

        steps.push(
            new CheckoutStep({
                id: CheckoutStepType.Time,
                url: '/checkout/' + CheckoutStepType.Time.toLowerCase(),
                active: checkoutMethod !== null && checkoutMethod.timeSlots.timeSlots.length > 1,
                skipHandler: () => {
                    // Use default or set to null if none available
                    if (this.$checkoutManager.checkout.checkoutMethod && this.$checkoutManager.checkout.checkoutMethod.timeSlots.timeSlots.length == 1) {
                        this.$checkoutManager.checkout.timeSlot = this.$checkoutManager.checkout.checkoutMethod.timeSlots.timeSlots[0];
                    } else {
                        this.$checkoutManager.checkout.timeSlot = null;
                    }

                    this.$checkoutManager.saveCheckout();
                },
                getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './TimeSelectionView.vue').then(m => new ComponentWithProperties(m.default, {})),
                validate: (checkout, webshop, organizationMeta) => checkout.validateTimeSlot(webshop, organizationMeta),
            }),
        );

        steps.push(
            new CheckoutStep({
                id: CheckoutStepType.Address,
                url: '/checkout/' + CheckoutStepType.Address.toLowerCase(),
                active: checkoutMethod !== null && checkoutMethod.type == CheckoutMethodType.Delivery,
                skipHandler: () => {
                    // Skip behaviour
                    // Clear address
                    this.$checkoutManager.checkout.address = null;
                    this.$checkoutManager.saveCheckout();
                },
                getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './AddressSelectionView.vue').then(m => new ComponentWithProperties(m.default, {})),
                validate: (checkout, webshop, organizationMeta) => checkout.validateDeliveryAddress(webshop, organizationMeta),
            }),
        );

        const loggedIn = this.$context.isComplete() ?? false;
        const user = loggedIn ? (this.$context.user ?? null) : null;

        // When a delivery method is chosen, the address is collected in the Address step, so we don't
        // need to ask for the customer address again.
        const hasDeliveryAddress = checkoutMethod !== null && checkoutMethod.type === CheckoutMethodType.Delivery;
        const customerSettings = webshop.meta.resolvedCustomerSettings;
        const asks = (requirement: CustomerFieldRequirement) => requirement !== CustomerFieldRequirement.Disabled;

        steps.push(new CheckoutStep({
            id: CheckoutStepType.Customer,
            url: '/checkout/' + CheckoutStepType.Customer.toLowerCase(),
            active: !loggedIn || asks(customerSettings.phone) || asks(customerSettings.birthDay) || asks(customerSettings.gender) || (asks(customerSettings.address) && !hasDeliveryAddress) || !user?.firstName || !user?.lastName,
            getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './CustomerView.vue').then(m => new ComponentWithProperties(m.default, {})),
            validate: (checkout, webshop, organizationMeta) => checkout.validateCustomer(webshop, organizationMeta, I18nController.i18n, false, loggedIn ? (this.$context.user ?? null) : null),
        }));

        for (const category of webshop.meta.recordCategories) {
            const id = `category-${category.id}`;
            const url = '/checkout/' + Formatter.slug(category.name);

            steps.push(new CheckoutStep({
                id,
                url,
                active: category.isEnabled(checkout),
                getComponent: async () => {
                    const { default: FillRecordCategoryView } = await import(/* webpackChunkName: "FillRecordCategoryView", webpackPrefetch: true */ '@stamhoofd/components/records/FillRecordCategoryView.vue');
                    return new ComponentWithProperties(FillRecordCategoryView, {
                        category,
                        url,
                        value: checkout,
                        forceMarkReviewed: true,
                        saveHandler: async (patch: PatchAnswers, navigate: NavigationActions) => {
                            checkout.recordAnswers = patchObject(checkout.recordAnswers, patch);
                            this.$checkoutManager.saveCheckout();

                            // Force a save if nothing changed (to fix timeSlot + updated data)
                            await this.goNext(id, navigate);
                        },
                        saveText: $t(`%16p`),
                    });
                },
                validate: (checkout, webshop) => {
                    checkout.validateRecordAnswersFor(webshop, category);
                },
                skipHandler: () => {
                    for (const record of category.getAllRecords()) {
                        this.$checkoutManager.checkout.recordAnswers.delete(record.id);
                    }
                    this.$checkoutManager.saveCheckout();
                },
            }));
        }

        // Payment
        steps.push(new CheckoutStep({
            id: CheckoutStepType.Payment,
            url: '/checkout/' + CheckoutStepType.Payment.toLowerCase(),
            getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './PaymentSelectionView.vue').then(m => new ComponentWithProperties(m.default, {})),
            validate: (checkout, webshop, organizationMeta) => checkout.validate(webshop, organizationMeta, I18nController.i18n),
        }));

        return steps;
    }

    async getNextStep(stepId: string | undefined, reload = false) {
        if (reload) {
            await this.$webshopManager.reload();
        }

        try {
            this.$checkoutManager.checkout.validateCart(this.$webshopManager.webshop, this.$webshopManager.organization.meta);
        } finally {
            this.$checkoutManager.checkout.update(this.$webshopManager.webshop);
        }

        const steps = this.getSteps();
        let next = stepId === undefined;
        for (const s of steps) {
            if (next) {
                if (s.active) {
                    return s;
                }

                if (s.skipHandler) {
                    s.skipHandler();
                }

                // Also validate skipped steps
                s.validate(this.$checkoutManager.checkout, this.$webshopManager.webshop, this.$webshopManager.organization.meta);
                continue;
            }

            // Validate all steps along the way
            s.validate(this.$checkoutManager.checkout, this.$webshopManager.webshop, this.$webshopManager.organization.meta);
            if (s.id === stepId) {
                next = true;
            }
        }

        // Last step
        return undefined;
    }

    /**
     * Whether an error thrown while validating or placing the order is about the cart contents
     */
    static isCartError(error: unknown): error is SimpleError | SimpleErrors {
        if (!isSimpleError(error) && !isSimpleErrors(error)) {
            return false;
        }
        return error.hasFieldThatStartsWith('cart') || error.hasFieldThatStartsWith('fieldAnswers');
    }

    /**
     * Reload the webshop and navigate back to where the user can fix the cart: the cart view, or the product view when there is no cart.
     */
    async handleCartError(error: SimpleError | SimpleErrors, navigate: NavigationActions) {
        await this.$webshopManager.reload();

        if (!this.$webshopManager.webshop.shouldEnableCart) {
            await navigate.dismiss({ force: true });
        } else {
            await navigate.navigationController!.popToRoot({ force: true });
        }
        Toast.fromError(error).show();
    }

    async goNext(step: string | undefined, navigate: NavigationActions) {
        let nextStep: CheckoutStep | undefined;

        // Force a save if nothing changed (to fix timeSlot + updated data)
        try {
            nextStep = await this.getNextStep(step, true);
        } catch (error) {
            if (CheckoutStepsManager.isCartError(error)) {
                await this.handleCartError(error, navigate);
            }
            throw error;
        }

        if (!nextStep) {
            throw new SimpleError({
                code: 'missing_config',
                message: $t(`%Xt`),
            });
        }

        navigate.show({
            components: [await this.getStepComponent(nextStep)],
            animated: true,
        }).catch(console.error);
    }

    /**
     * The component to push for a step, carrying the step url
     */
    async getStepComponent(step: CheckoutStep): Promise<ComponentWithProperties> {
        const component = await step.getComponent();
        component.provide.reactive_navigation_url = new ReactiveUrl({
            url: step.url,
        });
        return component;
    }
}
