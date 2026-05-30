<template>
    <LoadingViewTransition :error-box="errors.errorBox">
        <div v-if="status" class="st-view background">
            <STNavigationBar :title="$t('%1HV')" />

            <main>
                <h1>
                    {{ $t('%1HV') }}
                </h1>

                <p class="style-description-block">
                    <I18nComponent :t="$t('%1HX')">
                        <template #button="{content}">
                            <a class="inline-link" :href="'https://'+LocalizedDomains.marketing+'/prijzen'" target="_blank">
                                {{ content }}
                            </a>
                        </template>
                    </I18nComponent>
                </p>

                <STErrorsDefault :error-box="errors.errorBox" />

                <STList>
                    <STListItem v-for="pack of packages" :key="pack.bundle" element-name="button" :selectable="true" class="right-stack" @click="checkout(pack)">
                        <template #left>
                            <IconContainer :icon="pack.bundle === STPackageBundle.Webshops ? 'basket' : 'group'" :class="{gray: !pack.alreadyBought && !pack.inTrial, 'secundary': !pack.alreadyBought && pack.inTrial}">
                                <template #aside>
                                    <span v-if="pack.alreadyBought" v-tooltip="$t('%1TO')" class="icon success small primary" />
                                    <span v-else-if="pack.inTrial" v-tooltip="$t('%1TJ')" class="icon trial small stroke secundary" />
                                </template>
                            </IconContainer>
                        </template>

                        <p v-if="pack.inTrial && !pack.alreadyBought" class="style-title-prefix-list theme-secundary">
                            <span>{{ $t('%1HY') }}</span>
                        </p>

                        <p v-if="pack.alreadyBought && pack.expiresSoon" class="style-title-prefix-list">
                            {{ $t('%1HZ') }}
                        </p>

                        <p v-else-if="pack.alreadyBought" class="style-title-prefix-list">
                            {{ $t('%1H0') }}
                        </p>

                        <h3 class="style-title-list">
                            {{ pack.title }}
                        </h3>

                        <p v-if="pack.alreadyBought && pack.package.validUntil" class="style-description-small">
                            {{ $t('%1Ha', {dateTime: formatEndDate(pack.package.validUntil)}) }}
                        </p>

                        <p v-else-if="pack.inTrial && pack.package.validUntil" class="style-description-small">
                            {{ $t('%1Lv', {dateTime: formatEndDate(pack.package.validUntil)}) }}

                            <button type="button" class="inline-link error" @click.stop="stopTrial(pack)">
                                <span>{{ $t('%1Lw') }}</span>
                            </button>
                        </p>

                        <p class="style-description-small">
                            {{ pack.description }}
                        </p>

                        <template #right>
                            <LoadingButton :loading="pack.loading">
                                <span v-if="!pack.alreadyBought && (pack.inTrial || !pack.canStartTrial)" class="button text selected">
                                    <span>{{ $t('%1Lx') }}</span>
                                    <span class="icon arrow-right-small" />
                                </span>

                                <span v-if="!pack.alreadyBought && !pack.inTrial && pack.canStartTrial" class="button text selected">
                                    <span>{{ $t('%1Ly') }}</span>
                                    <span class="icon arrow-right-small" />
                                </span>

                                <span v-if="pack.alreadyBought && pack.expiresSoon" class="button text selected">
                                    <span>{{ $t('%1Lz') }}</span>
                                    <span class="icon arrow-right-small" />
                                </span>

                                <span v-else-if="pack.alreadyBought" class="button icon arrow-right-small" />
                            </LoadingButton>
                        </template>
                    </STListItem>
                </STList>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, useShow } from '@simonbackx/vue-app-navigation';
import LoadingViewTransition from '@stamhoofd/components/containers/LoadingViewTransition.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { useUser } from '@stamhoofd/components/hooks/useUser';
import IconContainer from '@stamhoofd/components/icons/IconContainer.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n/LocalizedDomains';
import type { STPackage, STPackageType } from '@stamhoofd/structures';
import { OrganizationCheckout, PackagePurchases, PaymentCustomer, PaymentMethod, STPackageBundle, STPackageBundleHelper } from '@stamhoofd/structures';
import { ref, watch } from 'vue';
import { useActivatePackages } from './hooks/useActivatePackages';
import { useDeactivatePackage } from './hooks/useDeactivatePackage';
import { useOrganizationPackages } from './hooks/useOrganizationPackages';
import { PayBalanceMode } from './OrganizationCheckoutViewModel';
import PackagesDetailsView from './PackagesDetailsView.vue';
import { useStartOrganizationCheckout } from './useStartOrganizationCheckout';

const errors = useErrors();
const organization = useRequiredOrganization();
const packages = ref([] as SelectablePackage[]);
const loadingModule = ref(null as STPackageType | null);
const deactivatePackage = useDeactivatePackage();
const startOrganizationCheckout = useStartOrganizationCheckout();
const show = useShow();
const { packages: status, reload } = useOrganizationPackages({ errors, onMounted: true });

class SelectablePackage {
    package: STPackage;
    bundle: STPackageBundle;
    alreadyBought = false;
    expiresSoon = false;
    inTrial = false;
    canStartTrial = true;
    loading = false;

    constructor(pack: STPackage, bundle: STPackageBundle) {
        this.package = pack;
        this.bundle = bundle;
    }

    get title() {
        return STPackageBundleHelper.getTitle(this.bundle);
    }

    get description() {
        return STPackageBundleHelper.getDescription(this.bundle);
    }
}

watch(status, () => {
    packages.value = getUpdatedPackages();
}, { immediate: true });

function getUpdatedPackages() {
    if (!status.value) {
        return [];
    }
    const packages: SelectablePackage[] = [];
    const limit = new Date();
    limit.setDate(limit.getDate() + 2 * 31);

    for (const bundle of Object.values(STPackageBundle)) {
        if (!STPackageBundleHelper.isPublic(bundle)) {
            continue;
        }

        const isCombineable = true;
        let isBought = false;
        let isTrial = false;
        let expiresSoon = false;
        let boughtPackage: null | STPackage = null;
        let trialPackage: null | STPackage = null;

        for (const p of status.value.packages) {
            if (!p.isActive) {
                continue;
            }

            if (STPackageBundleHelper.isAlreadyBought(bundle, p)) {
                isBought = true;

                if (!boughtPackage || p.endDate === null || (p.endDate !== null && boughtPackage.endDate !== null && p.endDate > boughtPackage.endDate)) {
                    // Take the package that is valid for the longest possible period
                    boughtPackage = p;
                }
            }

            if (STPackageBundleHelper.isInTrial(bundle, p)) {
                trialPackage = p;
                isTrial = true;
            }
        }

        if (!isCombineable) {
            continue;
        }

        if (boughtPackage && boughtPackage.endDate !== null && boughtPackage.endDate < limit) {
            // Allow to buy this package because it expires in less than 3 months, and it doesn't allow renewing
            expiresSoon = true;
        }

        try {
            const pack = boughtPackage ?? trialPackage ?? STPackageBundleHelper.getCurrentPackage(bundle, new Date());
            const pp = new SelectablePackage(pack, bundle);
            pp.alreadyBought = isBought;
            pp.inTrial = !isBought && isTrial;
            pp.expiresSoon = expiresSoon;

            const trialBundle = STPackageBundleHelper.getTrial(bundle);
            if (trialBundle) {
                const d = PackagePurchases.create({
                    packageBundles: [trialBundle],
                });
                try {
                    if (d.getPackages(status.value).length === 0) {
                        pp.canStartTrial = false;
                    }
                } catch (e) {
                    pp.canStartTrial = false;
                }
            } else {
                pp.canStartTrial = false;
            }

            packages.push(pp);
        } catch (e) {
            console.error(e);
        }
    }
    return packages;
}

async function stopTrial(pack: SelectablePackage) {
    if (pack.alreadyBought) {
        return;
    }

    if (!pack.inTrial) {
        return;
    }
    if (!await CenteredMessage.confirm($t('%1M0'), $t('%1M1'))) {
        return;
    }
    // Activate trial if possible (otherwise go to confirm)
    deactivatePackage.deactivate(pack.package, $t('%1M2')).catch(console.error);
}

const activatePackages = useActivatePackages();
const user = useUser();

async function checkoutTrial(bundle: STPackageBundle, message: string) {
    if (loadingModule.value) {
        new Toast($t('%1M3'), 'info').show();
        return;
    }
    loadingModule.value = bundle as any as STPackageType;

    try {
        await activatePackages(
            OrganizationCheckout.create({
                purchases: PackagePurchases.create({
                    packageBundles: [bundle],
                }),
                paymentMethod: PaymentMethod.Unknown,
                customer: PaymentCustomer.create({
                    firstName: user.value?.firstName,
                    lastName: user.value?.lastName,
                    email: user.value?.email,
                    company: organization.value.defaultCompanies[0],
                }),
            }),
        );
        await reload();
        new Toast(message, 'success green').show();
    } catch (e) {
        Toast.fromError(e).show();
    }

    loadingModule.value = null;
}
async function checkoutPackage(pack: SelectablePackage) {
    if (!status.value) {
        return;
    }

    if (pack.alreadyBought && !pack.expiresSoon) {
        // not allowed: open package details instead. We support multiple because we could already have renewed.
        // this shows both conditions
        const filteredPackages = status.value.packages.filter(p => p.isActive && (STPackageBundleHelper.isAlreadyBought(pack.bundle, p)));

        if (filteredPackages.length) {
            await show({
                components: [
                    new ComponentWithProperties(PackagesDetailsView, {
                        packages: filteredPackages,
                    }),
                ],
            });
        }
        return;
    }

    const checkout = OrganizationCheckout.create({
        purchases: PackagePurchases.create({
            packageBundles: [],
        }),
        paymentMethod: PaymentMethod.Unknown,
    });

    if (pack.alreadyBought && pack.expiresSoon && pack.package.meta.allowRenew) {
        checkout.purchases.renewPackageIds.push(pack.package.id);
    } else {
        // Activate instead
        checkout.purchases.packageBundles.push(pack.bundle);
    }

    pack.loading = true;
    await startOrganizationCheckout({
        payBalanceMode: PayBalanceMode.Required,
        checkout,
        displayOptions: { action: 'show' },
    });
    pack.loading = false;
}

async function checkout(pack: SelectablePackage) {
    if (!pack.alreadyBought && !pack.inTrial && pack.canStartTrial) {
        // Start trial
        switch (pack.bundle) {
            case STPackageBundle.Members: {
                await checkoutTrial(STPackageBundle.TrialMembers, 'wip');
                break;
            }
            case STPackageBundle.Webshops: {
                await checkoutTrial(STPackageBundle.TrialWebshops, $t('%1M5'));
                break;
            }
        }
        return;
    }
    await checkoutPackage(pack);
}

</script>
