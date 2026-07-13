import { ViewStepsManager } from '#steps/ViewStepsManager.ts';
import type { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import type { PlatformMember, RegisterCheckout, RegistrationWithTinyMember } from '@stamhoofd/structures';
import { GroupType, PaymentStatus, PlatformFamily, RegisterResponse } from '@stamhoofd/structures';
import { GlobalEventBus } from '../../EventBus';
import { Toast } from '../../overlays/Toast';

import type { DisplayOptions, NavigationActions } from '../../types/NavigationActions';
import { PaymentHandler } from '../../views/PaymentHandler';
import { updateContextFromMembersBlob } from '../helpers/updateContextFromMembersBlob';
import { FreeContributionStep } from './steps/FreeContributionStep';
import { PaymentCustomerStep } from './steps/PaymentCustomerStep';
import { PaymentSelectionStep } from './steps/PaymentSelectionStep';
import { Formatter } from '@stamhoofd/utility';

export async function startCheckout({ checkout, context, displayOptions, admin, members }: { checkout: RegisterCheckout; context: SessionContext; displayOptions: DisplayOptions; admin?: boolean; members?: PlatformMember[] }, navigate: NavigationActions) {
    checkout.validate({});

    const steps = [
        new FreeContributionStep(checkout),
        new PaymentCustomerStep(checkout),
        new PaymentSelectionStep(checkout),
    ];

    const stepManager = new ViewStepsManager(steps, async (navigate: NavigationActions) => {
        await register({ checkout, context, admin, members }, navigate);
    }, displayOptions);

    await stepManager.saveHandler(null, navigate);
}

export async function startSilentRegister({ checkout, context, admin, members }: { checkout: RegisterCheckout; context: SessionContext; admin?: boolean; members?: PlatformMember[] }) {
    checkout.validate({});
    await silentRegister({ checkout, context, admin, members });
}

function getIdCheckout({ checkout, admin }: { checkout: RegisterCheckout; admin?: boolean }) {
    const organization = checkout.singleOrganization!;
    const idCheckout = checkout.convert();

    if (!admin) {
        idCheckout.redirectUrl = new URL(organization.registerUrl);
        idCheckout.cancelUrl = new URL(organization.registerUrl);

        if (idCheckout.redirectUrl.hostname !== window.location.hostname) {
            // If we are not using the default member admin page
            // use the current location instead.
            idCheckout.redirectUrl = new URL(window.location.href);
            idCheckout.cancelUrl = new URL(window.location.href);

            if (idCheckout.redirectUrl.pathname.endsWith('/mandje')) {
                // Remove, so we go to start
                idCheckout.redirectUrl.pathname = idCheckout.redirectUrl.pathname.substring(0, idCheckout.redirectUrl.pathname.length - '/mandje'.length);
                idCheckout.cancelUrl = idCheckout.redirectUrl;
            }
        }
    } else {
        idCheckout.redirectUrl = new URL(window.location.href);
        idCheckout.cancelUrl = new URL(window.location.href);
    }

    // Force https protocol (the app can use capacitor:// instead of https, so we need to swap)
    if (idCheckout.redirectUrl.protocol !== 'https:') {
        // NOTE: setting protocol doesn't work in all situations (weird!)
        idCheckout.redirectUrl = new URL(idCheckout.redirectUrl.toString().replace(idCheckout.redirectUrl.protocol, 'https:'));
    }

    if (idCheckout.cancelUrl.protocol !== 'https:') {
        // NOTE: setting protocol doesn't work in all situations (weird!)
        idCheckout.cancelUrl = new URL(idCheckout.cancelUrl.toString().replace(idCheckout.cancelUrl.protocol, 'https:'));
    }

    return idCheckout;
}

/**
 * Register without ui
 * @param param0
 * @param navigate
 * @returns
 */
async function silentRegister({ checkout, context, admin, members }: { checkout: RegisterCheckout; context: SessionContext; admin?: boolean; members?: PlatformMember[] }) {
    const organization = checkout.singleOrganization!;
    const server = context.getAuthenticatedServerForOrganization(organization.id);
    const idCheckout = getIdCheckout({ checkout, admin });

    const response = await server.request({
        method: 'POST',
        path: '/members/register',
        body: idCheckout,
        decoder: RegisterResponse as Decoder<RegisterResponse>,
        shouldRetry: false,
    });

    const payment = response.data.payment;

    // Copy data to members
    PlatformFamily.updateFromBlob([...(members ?? []), ...checkout.cart.items.map(i => i.member)], response.data.members);
    updateContextFromMembersBlob(context, response.data.members);

    const clearAndEmit = () => {
        if (checkout.cart.items.length > 0) {
            GlobalEventBus.sendEvent('members-added', []).catch(console.error);
        } else if (checkout.cart.deleteRegistrations.length > 0) {
            GlobalEventBus.sendEvent('members-deleted', []).catch(console.error);
        }

        checkout.clear();
    };

    if (payment) {
        GlobalEventBus.sendEvent('paymentPatch', payment).catch(console.error);
    }

    clearAndEmit();
}

async function register({ checkout, context, admin, members }: { checkout: RegisterCheckout; context: SessionContext; admin?: boolean; members?: PlatformMember[] }, navigate: NavigationActions) {
    const organization = checkout.singleOrganization!;
    const server = context.getAuthenticatedServerForOrganization(organization.id);
    const clonedCheckout = checkout.clone(); // copy before we clear the checkout
    const idCheckout = getIdCheckout({ checkout, admin });

    const response = await server.request({
        method: 'POST',
        path: '/members/register',
        body: idCheckout,
        decoder: RegisterResponse as Decoder<RegisterResponse>,
        shouldRetry: false,
    });

    const payment = response.data.payment;
    const registrations = response.data.registrations;

    // Copy data to members
    PlatformFamily.updateFromBlob([...(members ?? []), ...checkout.cart.items.map(i => i.member)], response.data.members);
    updateContextFromMembersBlob(context, response.data.members);

    const clearAndEmit = () => {
        if (checkout.cart.items.length > 0) {
            GlobalEventBus.sendEvent('members-added', []).catch(console.error);
        } else if (checkout.cart.deleteRegistrations.length > 0) {
            GlobalEventBus.sendEvent('members-deleted', []).catch(console.error);
        }

        checkout.clear();
    };

    if (payment && payment.status !== PaymentStatus.Succeeded) {
        await PaymentHandler.handlePayment({
            server,
            organization: checkout.singleOrganization!,
            payment,
            paymentUrl: response.data.paymentUrl,
            paymentQRCode: response.data.paymentQRCode,
            navigate,
            transferSettings: checkout.singleOrganization!.meta.registrationPaymentConfiguration.transferSettings,
            type: 'registration',
        }, async (payment, navigate: NavigationActions) => {
            clearAndEmit();

            await navigate.show({
                components: [
                    AsyncComponent(() => import('../../payments/PaymentSuccessView.vue'), {
                        payment,
                    }),
                ],
                replace: 100, // autocorrects to all
                force: true,
            });
        }, (payment) => {
            if (payment && payment.status === PaymentStatus.Failed) {
                Toast.fromError($t('%1YU')).show();
            }
            // Silently ignore for now
            console.error('Failure handler for payment', payment);
        }, () => {
            console.log('Transfer handler');
            clearAndEmit();
        });
        return;
    }
    GlobalEventBus.sendEvent('paymentPatch', payment).catch(console.error);
    clearAndEmit();

    if (!payment) {
        Toast.success(fallback(registrations, clonedCheckout).description || fallback(registrations, clonedCheckout).title).setTestId('registration-checkout-succeeded').show();
        await navigate.dismiss({ force: true });
        return;
    }

    await navigate.show({
        components: [
            AsyncComponent(() => import('../../payments/PaymentSuccessView.vue'), {
                payment,
                fallback: fallback(registrations, clonedCheckout),
            }),
        ],
        replace: 100,
        force: true,
    });
}

function fallback(registrations: RegistrationWithTinyMember[], checkout: RegisterCheckout) {
    const names = Formatter.uniqueArray(registrations.filter(r => r.group.type !== GroupType.WaitingList).map(r => r.member.firstName ?? '?'));
    const waitingListNames = Formatter.uniqueArray(registrations.filter(r => r.group.type === GroupType.WaitingList).map(r => r.member.firstName ?? '?'));

    const t = $t(`%1cZ`);
    let d = '';

    if (names.length + waitingListNames.length === 0) {
        if (checkout.cart.deleteRegistrations.length >= 1) {
            const names = Formatter.uniqueArray(checkout.cart.deleteRegistrations.map(r => r.member.patchedMember.firstName));
            if (names.length === 1) {
                d += $t(`{name} is uitgeschreven voor {group}`, {
                    name: names.join('') + waitingListNames.join(''),
                    group: checkout.cart.deleteRegistrations.map(r => r.group.settings.name).join(', '),
                });
            } else {
                d += $t(`{jamesAndAnna} zijn uitgeschreven`, {
                    jamesAndAnna: Formatter.joinLastLimited(names, {
                        separator: ', ',
                        lastSeparator: ' ' + $t('en') + ' ',
                        maxLength: 70,
                        maxCount: 2,
                        textIfOverflow(notIncludedCount) {
                            return notIncludedCount + ' ' + $t(`%zn`);
                        },
                    }),
                });
            }
        }
    } else if (names.length + waitingListNames.length === 1) {
        d += $t(`{name} is ingeschreven voor {group}`, {
            name: names.join('') + waitingListNames.join(''),
            group: registrations[0].group.settings.name,
        });
    } else {
        if (names.length > 0) {
            if (names.length > 3) {
                d += Formatter.joinLast([...names.slice(0, 2), (names.length - 2) + ' ' + $t(`%zn`)], ', ', ' ' + $t(`%M1`) + ' ') + ' ' + $t(`%zo`);
            } else if (names.length > 1) {
                d += Formatter.joinLast(names, ', ', ' ' + $t(`%M1`) + ' ') + ' ' + $t(`%zo`);
            } else {
                d += names.join('') + ' ' + $t(`%zp`);
            }
        }

        if (waitingListNames.length > 0) {
            if (names.length > 0) {
                d += ' ' + $t(`%M1`) + ' ';
            }

            if (waitingListNames.length > 3) {
                d += Formatter.joinLast([...waitingListNames.slice(0, 2), (waitingListNames.length - 2) + ' ' + $t(`%zn`)], ', ', ' ' + $t(`%M1`) + ' ') + ' ' + $t(`%zq`);
            } else if (waitingListNames.length > 1) {
                d += Formatter.joinLast(waitingListNames, ', ', ' ' + $t(`%M1`) + ' ') + ' ' + $t(`%zq`);
            } else {
                d += waitingListNames.join('') + ' ' + $t(`%zr`);
            }
        }
    }

    return {
        title: t,
        description: Formatter.capitalizeFirstLetter(d),
    };
}
