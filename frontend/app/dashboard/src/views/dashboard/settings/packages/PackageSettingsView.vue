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
                    <STListItem v-for="pack of packages" :key="pack.bundle" :data-testid="'package-' + pack.bundle" element-name="button" :selectable="true" class="right-stack" @click="checkout(pack)">
                        <template #left>
                            <IconContainer :icon="pack.bundle === STPackageBundle.Webshops ? 'basket' : 'group'" :class="{gray: pack.status === PackageStatus.Inactive, 'secundary': pack.status === PackageStatus.Trial, 'error': pack.status === PackageStatus.Expired}">
                                <template #aside>
                                    <span v-if="pack.status === PackageStatus.Active" v-tooltip="$t('%1TO')" class="icon success small primary" />
                                    <span v-if="pack.status === PackageStatus.ExpiresSoon" v-tooltip="$t('Actief maar vervalt binnenkort')" class="icon warning small stroke yellow" />
                                    <span v-else-if="pack.status === PackageStatus.Trial" v-tooltip="$t('%1TJ')" class="icon trial small stroke secundary" />
                                </template>
                            </IconContainer>
                        </template>

                        <p v-if="pack.prefix" :class="'style-title-prefix-list ' + pack.prefixStyle">
                            <span>{{ pack.prefix }}</span>
                        </p>

                        <h3 class="style-title-list">
                            <span>{{ pack.title }}</span>

                            <span v-if="pack.suffix" :class="'style-tag ' + pack.suffixStyle">
                                {{ pack.suffix }}
                            </span>
                        </h3>

                        <p v-if="(pack.status === PackageStatus.Active || pack.status === PackageStatus.ExpiresSoon) && pack.package.endDate" class="style-description-small">
                            {{ $t('%1Ha', {dateTime: formatEndDate(pack.package.endDate)}) }}
                        </p>

                        <p v-if="pack.status === PackageStatus.Expired && pack.package.endDate" class="style-description-small">
                            {{ $t('Vervallen op {dateTime}', {dateTime: formatEndDate(pack.package.endDate)}) }}
                        </p>

                        <p v-else-if="pack.status === PackageStatus.Trial && pack.package.endDate" class="style-description-small">
                            {{ $t('%1Lv', {dateTime: formatEndDate(pack.package.endDate)}) }}

                            <button type="button" class="inline-link error" @click.stop="stopTrial(pack)">
                                <span>{{ $t('%1Lw') }}</span>
                            </button>
                        </p>

                        <p class="style-description-small">
                            {{ pack.description }}
                        </p>

                        <template #right>
                            <LoadingButton :loading="pack.loading">
                                <span class="button text selected">
                                    <span>{{ pack.statusAction }}</span>
                                    <span class="icon arrow-right-small" />
                                </span>
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
import { useMemberAdministrationOnboarding } from '../../../onboarding/useMemberAdministrationOnboarding';

const errors = useErrors();
const organization = useRequiredOrganization();
const packages = ref([] as SelectablePackage[]);
const loadingModule = ref(null as STPackageType | null);
const deactivatePackage = useDeactivatePackage();
const startOrganizationCheckout = useStartOrganizationCheckout();
const show = useShow();
const { packages: status, reload } = useOrganizationPackages({ errors, onMounted: true });

enum PackageStatus {
    /**
     * Inactive. Action => start trial if allowed otherwise buy package again
     */
    Inactive = 'Inactive',

    /**
     * Trial. Action => buy package
     */
    Trial = 'Trial',

    /**
     * Active action => view packages
     */
    Active = 'Active',

    /**
     * ExpiresSoon action => renew package if allowed otherwise buy package again
     */
    ExpiresSoon = 'ExpiresSoon',

    /**
     * ExpiresSoon action => renew package if allowed otherwise buy package again
     */
    Expired = 'Expired',
}

class SelectablePackage {
    package: STPackage;
    bundle: STPackageBundle;
    isActive = false;
    expiresSoon = false;
    allowRenew = false;
    expired = false;
    inTrial = false;
    canStartTrial = true;
    loading = false;

    status = PackageStatus.Inactive;

    get statusAction() {
        switch (this.status) {
            case PackageStatus.Inactive: {
                return $t('Uitproberen');
            }

            case PackageStatus.Trial: {
                return $t('Activeren');
            }

            case PackageStatus.Active: {
                return $t('Bekijk');
            }

            case PackageStatus.ExpiresSoon: {
                if (this.allowRenew) {
                    return $t('Verlengen');
                }
                return $t('Verlengen');
            }

            case PackageStatus.Expired: {
                if (this.allowRenew) {
                    return $t('Heractiveren');
                }
                return $t('Heractiveren');
            }
        }
    }

    get prefix() {
        switch (this.status) {
            case PackageStatus.Inactive: {
                return null;
            }

            case PackageStatus.Trial: {
                return $t('In proefperiode');
            }

            case PackageStatus.Expired: {
                return $t('Vervallen');
            }
        }
    }

    get prefixStyle() {
        switch (this.status) {
            case PackageStatus.Inactive: {
                return null;
            }

            case PackageStatus.Trial: {
                return 'theme-secundary';
            }

            case PackageStatus.ExpiresSoon: {
                return 'theme-warning';
            }

            case PackageStatus.Expired: {
                return 'theme-error';
            }
        }
    }

    get suffix() {
        switch (this.status) {
            case PackageStatus.ExpiresSoon: {
                return $t('Vervalt binnenkort');
            }
        }
    }

    get suffixStyle() {
        switch (this.status) {
            case PackageStatus.ExpiresSoon: {
                return 'warn';
            }
        }
    }

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
        let isActive = false;
        let isTrial = false;
        const expiresSoon = false;
        let boughtPackage: null | STPackage = null;
        let trialPackage: null | STPackage = null;

        for (const p of status.value.packages) {
            if (p.removeAt && p.removeAt < new Date()) {
                continue;
            }

            if (STPackageBundleHelper.isAlreadyBought(bundle, p)) {
                isActive = isActive || p.isActive;

                if (!boughtPackage || p.endDate === null || (p.endDate !== null && boughtPackage.endDate !== null && p.endDate > boughtPackage.endDate)) {
                    // Take the package that is valid for the longest possible period
                    boughtPackage = p;
                }
            }

            if (STPackageBundleHelper.isInTrial(bundle, p) && p.isActive) {
                trialPackage = p;
                isTrial = true;
            }
        }

        if (!isCombineable) {
            continue;
        }

        try {
            const pack = boughtPackage ?? trialPackage ?? STPackageBundleHelper.getCurrentPackage(bundle, new Date());
            const pp = new SelectablePackage(pack, bundle);
            if (isActive) {
                if (boughtPackage && boughtPackage.endDate !== null && boughtPackage.endDate < limit) {
                    // Allow to buy this package because it expires in less than 3 months, and it doesn't allow renewing
                    pp.status = PackageStatus.ExpiresSoon;
                    pp.allowRenew = boughtPackage.meta.allowRenew;
                } else {
                    pp.status = PackageStatus.Active;
                }
            } else {
                if (isTrial) {
                    pp.status = PackageStatus.Trial;
                } else if (boughtPackage && boughtPackage.endDate !== null && boughtPackage.endDate < new Date()) {
                    pp.status = PackageStatus.Expired;
                    pp.allowRenew = boughtPackage.meta.allowRenew;
                } else {
                    pp.status = PackageStatus.Inactive;
                }
            }

            /* const trialBundle = STPackageBundleHelper.getTrial(bundle);
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
            } */

            packages.push(pp);
        } catch (e) {
            console.error(e);
        }
    }
    return packages;
}

async function stopTrial(pack: SelectablePackage) {
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
    const checkout = OrganizationCheckout.create({
        purchases: PackagePurchases.create({
            packageBundles: [],
        }),
        paymentMethod: PaymentMethod.Unknown,
    });

    if (pack.allowRenew) {
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

async function viewPackages(pack: SelectablePackage) {
    if (!status.value) {
        new Toast($t('%1M3'), 'info').show();
        return;
    }

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

const startMemberAdministrationOnboarding = useMemberAdministrationOnboarding();

async function checkout(pack: SelectablePackage) {
    switch (pack.status) {
        case PackageStatus.Inactive: {
            // Start trial
            switch (pack.bundle) {
                case STPackageBundle.Members: {
                    await startMemberAdministrationOnboarding();
                    break;
                }
                case STPackageBundle.Webshops: {
                    await checkoutTrial(STPackageBundle.TrialWebshops, $t('%1M5'));
                    break;
                }
            }
            return;
        }

        case PackageStatus.Active: {
            await viewPackages(pack);
            return;
        }

        case PackageStatus.Trial:
        case PackageStatus.ExpiresSoon:
        case PackageStatus.Expired: {
            await checkoutPackage(pack);
            return;
        }
    }
}

</script>
