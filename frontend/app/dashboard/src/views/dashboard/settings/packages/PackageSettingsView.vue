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
                                    <span v-if="pack.alreadyBought" v-tooltip="'Deze functie is actief'" class="icon success small primary" />
                                    <span v-else-if="pack.inTrial" v-tooltip="'Momenteel in proefperiode, activeer om in gebruik te nemen'" class="icon trial small stroke secundary" />
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
                            {{ $t('%1Ha', {dateTime: formatDateTime(pack.package.validUntil)}) }}
                        </p>

                        <p v-else-if="pack.inTrial && pack.package.validUntil" class="style-description-small">
                            {{ $t('%1Lv', {dateTime: formatDateTime(pack.package.validUntil)}) }}

                            <button type="button" class="inline-link error" @click.stop="stopTrial(pack)">
                                <span>{{ $t('%1Lw') }}</span>
                            </button>
                        </p>

                        <p class="style-description-small">
                            {{ pack.description }}
                        </p>

                        <template #right>
                            <span v-if="!pack.alreadyBought && (pack.inTrial || !pack.canStartTrial)" class="button text selected">
                                <span>{{ $t('%1Lx') }}</span>
                                <span class="icon arrow-right-small" />
                            </span>

                            <span v-if="!pack.alreadyBought && !pack.inTrial && pack.canStartTrial" class="button text selected">
                                <span>{{ $t('%1Ly') }}</span>
                                <span class="icon arrow-right-small" />
                            </span>

                            <span v-if="pack.alreadyBought && pack.expiresSoon && pack.package.meta.allowRenew" class="button text selected">
                                <span>{{ $t('%1Lz') }}</span>
                                <span class="icon arrow-right-small" />
                            </span>

                            <span v-else-if="pack.alreadyBought" class="button icon arrow-right-small" />
                        </template>
                    </STListItem>
                </STList>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import IconContainer from '@stamhoofd/components/icons/IconContainer.vue';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n/LocalizedDomains';
import type { STPackage, STPackageType } from '@stamhoofd/structures';
import { PackageCheckout, PackagePurchases, PaymentMethod, STPackageBundle, STPackageBundleHelper } from '@stamhoofd/structures';
import { ref, watch } from 'vue';
import { useDeactivatePackage } from './hooks/useDeactivatePackage';
import { useOrganizationPackages } from './hooks/useOrganizationPackages';
import { startCheckout } from './startCheckout';
import LoadingViewTransition from '@stamhoofd/components/containers/LoadingViewTransition.vue';

const errors = useErrors();
const organization = useRequiredOrganization();
const packages = ref([] as SelectablePackage[]);
const context = useContext();
const loadingModule = ref(null as STPackageType | null);
const deactivatePackage = useDeactivatePackage();

const { packages: status, reload } = useOrganizationPackages({ errors, onMounted: true });

class SelectablePackage {
    package: STPackage;

    // In case of a renewal, bundle can be empty
    bundle: STPackageBundle;

    alreadyBought = false;
    expiresSoon = false;
    inTrial = false;
    canStartTrial = true;

    selected = false;

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
            if (p.validUntil !== null) {
                if (p.validUntil < new Date()) {
                    // Allow to buy this package because it is expired
                    continue;
                }
            }

            if (STPackageBundleHelper.isAlreadyBought(bundle, p)) {
                isBought = true;

                if (!boughtPackage || p.validUntil === null || (p.validUntil !== null && boughtPackage.validUntil !== null && p.validUntil > boughtPackage.validUntil)) {
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

        if (boughtPackage && boughtPackage.validUntil !== null && boughtPackage.validUntil < limit) {
            // Allow to buy this package because it expires in less than 3 months, and it doesn't allow renewing
            expiresSoon = true;
        }

        try {
            const pack = boughtPackage ?? trialPackage ?? STPackageBundleHelper.getCurrentPackage(bundle, new Date());
            const pp = new SelectablePackage(pack, bundle);
            pp.alreadyBought = isBought;
            pp.inTrial = isTrial;
            pp.expiresSoon = expiresSoon;
            if (bundle === STPackageBundle.Members && !organization.value.meta.packages.canStartMembersTrial) {
                pp.canStartTrial = false;
            }

            if (bundle === STPackageBundle.Webshops && !organization.value.meta.packages.canStartWebshopsTrial) {
                pp.canStartTrial = false;
            }
            packages.push(pp);
        }
        catch (e) {
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

async function checkoutTrial(bundle: STPackageBundle, message: string) {
    if (loadingModule.value) {
        new Toast($t('%1M3'), 'info').show();
        return;
    }
    loadingModule.value = bundle as any as STPackageType;

    try {
        await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/billing/activate-packages',
            body: PackageCheckout.create({
                purchases: PackagePurchases.create({
                    packageBundles: [bundle],
                }),
                paymentMethod: PaymentMethod.Unknown,
            }),
            shouldRetry: false,
        });
        await context.value.fetchOrganization(false);
        await reload();
        new Toast(message, 'success green').show();
    }
    catch (e) {
        Toast.fromError(e).show();
    }

    loadingModule.value = null;
}
const navigationActions = useNavigationActions();
async function checkoutPackage(pack: SelectablePackage) {
    const checkout = PackageCheckout.create({
        purchases: PackagePurchases.create({
            packageBundles: [],
        }),
        paymentMethod: PaymentMethod.Unknown,
    })

    if (pack.alreadyBought && pack.expiresSoon && pack.package.meta.allowRenew) {
        checkout.purchases.renewPackageIds.push(pack.package.id);
    } else {
        // Activate instead
        checkout.purchases.packageBundles.push(pack.bundle);
    }
    
    await startCheckout({
        checkout,
        context: context.value,
        displayOptions: { action: 'show' }
    }, navigationActions);
}

async function checkout(pack: SelectablePackage) {
    if (!pack.alreadyBought && !pack.inTrial && pack.canStartTrial) {
        // Start trial
        switch (pack.bundle) {
            case STPackageBundle.Members: {
                if (!organization.value.meta.packages.canStartMembersTrial) {
                    new Toast($t('%1M4'), 'error').show();
                    await checkoutPackage(pack);
                    return;
                }
                // Activate trial if possible (otherwise go to confirm)
                // this.setupMemberAdministration();
                break;
            }
            case STPackageBundle.Webshops: {
                if (!organization.value.meta.packages.canStartWebshopsTrial) {
                    new Toast($t('%1M4'), 'error').show();
                    await checkoutPackage(pack);
                    return;
                }
                // Activate trial if possible (otherwise go to confirm)
                await checkoutTrial(STPackageBundle.TrialWebshops, $t('%1M5'));
                break;
            }
        }
        return;
    }
    await checkoutPackage(pack);
}

</script>
