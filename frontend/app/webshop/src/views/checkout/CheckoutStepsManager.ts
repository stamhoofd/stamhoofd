import type { SimpleErrors } from '@common/errors';
import { isSimpleError, isSimpleErrors, SimpleError } from '@common/errors';
import { ComponentWithProperties, ReactiveUrl } from '@browser/navigation';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import type { CartItem, CheckoutMethod, OrganizationMetaData, PatchAnswers, Product, Webshop } from '@stamhoofd/structures';
import { Checkout, CheckoutMethodType, WebshopOrderMode } from '@stamhoofd/structures';
import { CustomerFieldRequirement } from '@stamhoofd/structures/webshops/CustomerFieldRequirement.js';
import { customerFieldKeys } from '@stamhoofd/structures/webshops/CustomerSettings.js';
import { Formatter } from '@stamhoofd/utility';
import { getUnitName } from '@stamhoofd/components/helpers/webshopWording.ts';

import { patchObject } from '@common/encoding';
import type { CheckoutManager } from '../../classes/CheckoutManager';

export enum CheckoutStepType {
    Method = 'Method',
    Address = 'Address',
    Customer = 'Customer',
    Time = 'Time',
    Payment = 'Payment',
    Details = 'Details',
}

/**
 * Whether the bulk details step needs input for this item
 */
export function cartItemNeedsDetails(item: CartItem): boolean {
    return item.product.optionMenus.length > 0
        || item.product.customFields.length > 0
        || item.product.enableCustomer
        || item.productPrice.uitpasBaseProductPriceId !== null;
}

export class CheckoutStep {
    id: string;
    /** Short name of the step, shown in the checkout progress */
    title: string;
    active: boolean;
    url: string;
    skipHandler?: () => void;
    getComponent: () => Promise<ComponentWithProperties>;
    validate: (checkout: Checkout, webshop: Webshop, organizationMeta: OrganizationMetaData) => void;

    constructor(data: {
        id: string;
        title: string;
        active?: boolean;
        url: string;
        skipHandler?: () => void;
        getComponent: () => Promise<ComponentWithProperties>;
        validate: (checkout: Checkout, webshop: Webshop, organizationMeta: OrganizationMetaData) => void;
    }) {
        this.id = data.id;
        this.title = data.title;
        this.active = data.active ?? true;
        this.skipHandler = data.skipHandler;
        this.getComponent = data.getComponent;
        this.validate = data.validate;
        this.url = data.url;
    }
}

export class CheckoutStepsManager {
    /**
     * Url of the product form that comes before the checkout steps in a webshop with one product and no cart
     */
    static readonly productUrl = 'product';

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

    private static readonly seatsStepPrefix = 'seats-';

    static seatsStepId(product: Product) {
        return CheckoutStepsManager.seatsStepPrefix + product.id;
    }

    /// Return all the steps that are confirmed with the current checkout configuration
    getSteps(): CheckoutStep[] {
        const webshop = this.$webshopManager.webshop;
        const checkout = this.$checkoutManager.checkout;
        const checkoutMethod = webshop.meta.checkoutMethods.find(m => m.id === checkout.checkoutMethod?.id) ?? (webshop.meta.checkoutMethods[0] as CheckoutMethod | undefined) ?? null;
        const steps: CheckoutStep[] = [];
        const bulk = webshop.orderMode === WebshopOrderMode.Bulk;

        // Bulk: seats per seated product, then the details of every item
        const seatedProducts = bulk
            ? webshop.products.filter(p => p.seatingPlanId !== null && checkout.cart.items.some(i => i.product.id === p.id))
            : [];

        for (const product of seatedProducts) {
            const id = CheckoutStepsManager.seatsStepId(product);
            // E.g. the same show on two dates: told apart by the date, and the url needs to stay unique
            const sameName = seatedProducts.filter(p => p.name === product.name).length > 1;
            const date = sameName && product.dateRange ? ' ' + Formatter.date(product.dateRange.startDate) : '';
            steps.push(new CheckoutStep({
                id,
                // With more than one seated product, the steps are told apart by product
                title: seatedProducts.length > 1 ? product.name + date : $t('%sB'),
                url: '/checkout/seats/' + Formatter.slug(product.name) + (sameName ? '-' + product.id.slice(0, 8) : ''),
                getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './BulkSeatsView.vue').then(m => new ComponentWithProperties(m.default, {
                    product,
                    continueCheckout: (navigate: NavigationActions) => this.goNext(id, navigate),
                })),
                validate: (checkout) => {
                    const missing = checkout.cart.items.filter(i => i.product.id === product.id && i.seats.length !== i.amount);
                    if (missing.length > 0) {
                        throw new SimpleError({
                            code: 'invalid_seats',
                            message: 'Missing seats',
                            human: $t('Kies eerst alle plaatsen voor {product}', { product: product.name }),
                            field: 'cart',
                        });
                    }
                },
            }));
        }

        // Named after what the items are when they are all the same kind, e.g. "Deelnemers"
        const detailsUnitNames = new Set(checkout.cart.items.filter(i => cartItemNeedsDetails(i)).map(i => getUnitName(webshop, i.product).plural));

        steps.push(new CheckoutStep({
            id: CheckoutStepType.Details,
            title: detailsUnitNames.size === 1 ? Formatter.capitalizeFirstLetter([...detailsUnitNames][0]) : $t('Details'),
            url: '/checkout/' + CheckoutStepType.Details.toLowerCase(),
            active: bulk && detailsUnitNames.size > 0,
            getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './BulkItemDetailsView.vue').then(m => new ComponentWithProperties(m.default, {
                continueCheckout: (navigate: NavigationActions) => this.goNext(CheckoutStepType.Details, navigate),
            })),
            validate: () => {
                // Items are validated by validateCart at the start of getNextStep
            },
        }));

        steps.push(
            new CheckoutStep({
                id: CheckoutStepType.Method,
                title: $t('%xE'),
                url: '/checkout/' + CheckoutStepType.Method.toLowerCase(),
                active: webshop.meta.checkoutMethods.length > 1,
                skipHandler: () => {
                    // Skip behaviour
                    // Set to the only available checkout method
                    this.$checkoutManager.checkout.checkoutMethod = this.$webshopManager.webshop.meta.checkoutMethods.length == 0 ? null : this.$webshopManager.webshop.meta.checkoutMethods[0];
                    this.$checkoutManager.saveCheckout();
                },
                getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './CheckoutMethodSelectionView.vue').then(m => new ComponentWithProperties(m.default, {
                    continueCheckout: (navigate: NavigationActions) => this.goNext(CheckoutStepType.Method, navigate),
                })),
                validate: (checkout, webshop, organizationMeta) => checkout.validateCheckoutMethod(webshop, organizationMeta),
            }),
        );

        steps.push(
            new CheckoutStep({
                id: CheckoutStepType.Time,
                title: $t('%1GD'),
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
                getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './TimeSelectionView.vue').then(m => new ComponentWithProperties(m.default, {
                    continueCheckout: (navigate: NavigationActions) => this.goNext(CheckoutStepType.Time, navigate),
                })),
                validate: (checkout, webshop, organizationMeta) => checkout.validateTimeSlot(webshop, organizationMeta),
            }),
        );

        steps.push(
            new CheckoutStep({
                id: CheckoutStepType.Address,
                title: $t('%Us'),
                url: '/checkout/' + CheckoutStepType.Address.toLowerCase(),
                active: checkoutMethod !== null && checkoutMethod.type == CheckoutMethodType.Delivery,
                skipHandler: () => {
                    // Skip behaviour
                    // Clear address
                    this.$checkoutManager.checkout.address = null;
                    this.$checkoutManager.saveCheckout();
                },
                getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './AddressSelectionView.vue').then(m => new ComponentWithProperties(m.default, {
                    continueCheckout: (navigate: NavigationActions) => this.goNext(CheckoutStepType.Address, navigate),
                })),
                validate: (checkout, webshop, organizationMeta) => checkout.validateDeliveryAddress(webshop, organizationMeta),
            }),
        );

        const loggedIn = this.$context.isComplete() ?? false;
        const user = loggedIn ? (this.$context.user ?? null) : null;

        // When a delivery method is chosen, the address is collected in the Address step, so we don't
        // need to ask for the customer address again.
        const hasDeliveryAddress = checkoutMethod !== null && checkoutMethod.type === CheckoutMethodType.Delivery;
        const customerSettings = webshop.meta.customerSettings;
        const asks = (requirement: CustomerFieldRequirement) => requirement !== CustomerFieldRequirement.Disabled;
        const asksCustomerQuestions = (customerSettings.recordCategory?.isEnabled(checkout) ?? false) || webshop.meta.customFields.length > 0;

        // A single participant becomes the contact person without asking, unless the order needs more than what was
        // collected for them.
        const participants = checkout.cart.items.filter(i => i.customer !== null);
        const singleParticipant = !loggedIn && participants.length === 1 ? participants[0] : null;
        const singleParticipantSuffices = singleParticipant !== null
            && !asksCustomerQuestions
            && Checkout.canBeAutomaticContactPerson(singleParticipant)
            && customerFieldKeys.every(key => !asks(customerSettings[key]) || singleParticipant.collectedCustomerFields.includes(key) || (key === 'address' && hasDeliveryAddress));

        steps.push(new CheckoutStep({
            id: CheckoutStepType.Customer,
            title: $t('%zM'),
            url: '/checkout/' + CheckoutStepType.Customer.toLowerCase(),
            active: loggedIn
                ? (asks(customerSettings.phone) || asks(customerSettings.birthDay) || asks(customerSettings.gender) || (asks(customerSettings.address) && !hasDeliveryAddress) || !user?.firstName || !user?.lastName || asksCustomerQuestions)
                : !singleParticipantSuffices,
            skipHandler: () => {
                if (singleParticipant) {
                    this.$checkoutManager.checkout.setContactPerson(singleParticipant.id);
                    this.$checkoutManager.saveCheckout();
                }
            },
            getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './CustomerView.vue').then(m => new ComponentWithProperties(m.default, {
                continueCheckout: (navigate: NavigationActions) => this.goNext(CheckoutStepType.Customer, navigate),
            })),
            validate: (checkout, webshop, organizationMeta) => checkout.validateCustomer(webshop, organizationMeta, I18nController.i18n, false, loggedIn ? (this.$context.user ?? null) : null),
        }));

        for (const category of webshop.meta.recordCategories) {
            const id = `category-${category.id}`;
            const url = '/checkout/' + Formatter.slug(category.name);

            steps.push(new CheckoutStep({
                id,
                title: category.name.toString(),
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
            // Nothing to pay: the step only confirms the order
            title: checkout.totalPrice > 0 ? $t('%eX') : $t('%1V8'),
            url: '/checkout/' + CheckoutStepType.Payment.toLowerCase(),
            getComponent: () => import(/* webpackChunkName: "Checkout", webpackPrefetch: true */ './PaymentSelectionView.vue').then(m => new ComponentWithProperties(m.default, {
                handleCheckoutError: async (error: unknown, navigate: NavigationActions) => {
                    if (CheckoutStepsManager.isCartError(error)) {
                        await this.handleCartError(error, navigate);
                    }
                },
            })),
            validate: (checkout, webshop, organizationMeta) => checkout.validate(webshop, organizationMeta, I18nController.i18n),
        }));

        return steps;
    }

    async getNextStep(stepId: string | undefined, reload = false) {
        if (reload) {
            await this.$webshopManager.reload();
        }

        const bulk = this.$webshopManager.webshop.orderMode === WebshopOrderMode.Bulk;

        // Bulk: options, fields and customers are collected in the details step, so don't require them before it
        const detailsPending = bulk && (stepId === undefined || stepId.startsWith(CheckoutStepsManager.seatsStepPrefix));

        // Bulk: seats are checked as soon as every unit has one, so a taken seat is found when leaving the last seats step
        const validateSeats = !bulk || this.allSeatsChosen;

        try {
            this.$checkoutManager.checkout.validateCart(this.$webshopManager.webshop, this.$webshopManager.organization.meta, false, { validateSeats, validateDetails: !detailsPending });
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
     * Bulk: seats are only checked once every unit has one, before that the seats steps still have to collect them
     */
    private get allSeatsChosen() {
        return this.$checkoutManager.cart.items.every(i => !i.product.seatingPlanId || i.seats.length === i.amount);
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
     * Reload the webshop and navigate back to where the user can fix the cart.
     * Bulk: to the details step when it is active, otherwise to the product list. Cart: the cart view. Single: the product view.
     */
    async handleCartError(error: SimpleError | SimpleErrors, navigate: NavigationActions) {
        await this.$webshopManager.reload();
        const webshop = this.$webshopManager.webshop;

        if (webshop.orderMode === WebshopOrderMode.Bulk) {
            try {
                // Stores recoverable errors on the items for the details step and drops invalid ones. Missing details are
                // not an error yet: the details step collects and shows them.
                this.$checkoutManager.cart.validate(webshop, false, { validateDetails: false, validateSeats: this.allSeatsChosen });
            } catch (e) {
                console.error(e);
            }
            this.$checkoutManager.saveCart();

            const steps = this.getSteps();

            // A seat that is no longer available can only be chosen again in the seats step of its product
            const seatItem = this.$checkoutManager.cart.items.find(i => isSimpleError(i.cartError) && ['seats_unavailable', 'invalid_seats'].includes(i.cartError.code));
            const seatsStep = seatItem ? steps.find(s => s.id === CheckoutStepsManager.seatsStepId(seatItem.product)) : undefined;
            if (seatsStep && await CheckoutStepsManager.popToUrl(navigate.navigationController, seatsStep.url, { force: true })) {
                Toast.fromError(error).show();
                return;
            }

            const detailsStep = steps.find(s => s.id === (CheckoutStepType.Details as string));
            if (detailsStep?.active && await CheckoutStepsManager.popToUrl(navigate.navigationController, detailsStep.url, { force: true })) {
                this.$checkoutManager.pendingCartError = error;
                return;
            }
        }

        // Back to the cart, or to the webshop itself when there is no cart
        if (!webshop.shouldEnableCart || !(await CheckoutStepsManager.popToUrl(navigate.navigationController, 'cart', { force: true }))) {
            await navigate.navigationController!.popToRoot({ force: true });
        }
        Toast.fromError(error).show();
    }

    /**
     * Pop back to the component with the given url on a navigation controller. Returns false when it isn't on the stack.
     */
    static async popToUrl(navigationController: NavigationActions['navigationController'] | null, url: string, options: { force?: boolean } = {}): Promise<boolean> {
        if (!navigationController) {
            return false;
        }
        const components = navigationController.components;
        const index = components.findIndex(c => c.provide.reactive_navigation_url?.url === url);
        if (index < 0) {
            return false;
        }
        const count = components.length - 1 - index;
        if (count > 0) {
            await navigationController.pop({ count, force: options.force });
        }
        return true;
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
