<template>
    <LoadingViewTransition :error-box="errors.errorBox">
        <div v-if="status" class="st-view background">
            <STNavigationBar :title="$t('04fe8969-a277-417d-92e8-8bd532affc19')" />

            <main>
                <h1>
                    {{ $t('04fe8969-a277-417d-92e8-8bd532affc19') }}
                </h1>

                <p class="style-description-block">
                    <I18nComponent :t="$t('5afbf5f5-1051-4a95-9c90-602c828094fa')">
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
                            <span>{{ $t('6ed63ff0-296c-4151-905a-fc6fdc7832e8') }}</span>
                        </p>

                        <p v-if="pack.alreadyBought && pack.expiresSoon" class="style-title-prefix-list">
                            {{ $t('b69ae0b8-d957-4dde-b06d-a6f97ceea656') }}
                        </p>

                        <p v-else-if="pack.alreadyBought" class="style-title-prefix-list">
                            {{ $t('493f3fc9-ea9e-4b3d-8af6-e15cd3fd2539') }}
                        </p>

                        <h3 class="style-title-list">
                            {{ pack.title }}
                        </h3>

                        <p v-if="pack.alreadyBought && pack.package.validUntil" class="style-description-small">
                            {{ $t('e40ae4e1-abe1-418d-8662-16626c93acc2', {dateTime: formatDateTime(pack.package.validUntil)}) }}
                        </p>

                        <p v-else-if="pack.inTrial && pack.package.validUntil" class="style-description-small">
                            {{ $t('Proefperiode geldig tot {dateTime}.', {dateTime: formatDateTime(pack.package.validUntil)}) }}

                            <button type="button" class="inline-link error" @click.stop="stopTrial(pack)">
                                <span>{{ $t('Stopzetten') }}</span>
                            </button>
                        </p>

                        <p class="style-description-small">
                            {{ pack.description }}
                        </p>

                        <template #right>
                            <span v-if="!pack.alreadyBought && (pack.inTrial || !pack.canStartTrial)" class="button text selected">
                                <span>{{ $t('Activeren') }}</span>
                                <span class="icon arrow-right-small" />
                            </span>

                            <span v-if="!pack.alreadyBought && !pack.inTrial && pack.canStartTrial" class="button text selected">
                                <span>{{ $t('Uitproberen') }}</span>
                                <span class="icon arrow-right-small" />
                            </span>

                            <span v-if="pack.alreadyBought && pack.expiresSoon && pack.package.meta.allowRenew" class="button text selected">
                                <span>{{ $t('Verlengen') }}</span>
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
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, IconContainer, Toast, useContext, useErrors, useRequiredOrganization } from '@stamhoofd/components';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n';
import { useRequestOwner } from '@stamhoofd/networking';
import { PackageCheckout, PackagePurchases, PaymentMethod, STPackage, STPackageBundle, STPackageBundleHelper, STPackageType } from '@stamhoofd/structures';
import { ref, watch } from 'vue';
import { useOrganizationPackages } from './hooks/useOrganizationPackages';
import { useDeactivatePackage } from './hooks/useDeactivatePackage';

const errors = useErrors();
const organization = useRequiredOrganization();
const packages = ref([] as SelectablePackage[]);
const owner = useRequestOwner();
const context = useContext();
const dismiss = useDismiss();
const loadingModule = ref(null as STPackageType | null);
const deactivatePackage = useDeactivatePackage();

const { loading: loadingStatus, packages: status, reload } = useOrganizationPackages({ errors, onMounted: true });

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

        let isCombineable = true;
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
    if (!await CenteredMessage.confirm($t('Ben je zeker dat je de proefperiode wilt stopzetten?'), $t('Ja, stopzetten'))) {
        return;
    }
    // Activate trial if possible (otherwise go to confirm)
    deactivatePackage.deactivate(pack.package, $t('Proefperiode stopgezet')).catch(console.error);
}

async function checkoutTrial(bundle: STPackageBundle, message: string) {
    if (loadingModule.value) {
        new Toast($t('Even geduld, nog bezig met laden...'), 'info').show();
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

async function openPackageDetails(pack: SelectablePackage) {
    // this.show(new ComponentWithProperties(PackageConfirmView, {
    //    bundles: [pack.bundle]
    // }))
}

async function checkout(pack: SelectablePackage) {
    if (!pack.alreadyBought && !pack.inTrial && pack.canStartTrial) {
        // Start trial
        switch (pack.bundle) {
            case STPackageBundle.Members: {
                if (!organization.value.meta.packages.canStartMembersTrial) {
                    new Toast($t('Je hebt geen recht meer om een proefperiode op te starten. Je kan wel het pakket activeren. Neem contact op met Stamhoofd als je deze toch wilt gebruiken.'), 'error').show();
                    await openPackageDetails(pack);
                    return;
                }
                // Activate trial if possible (otherwise go to confirm)
                // this.setupMemberAdministration();
                break;
            }
            case STPackageBundle.Webshops: {
                if (!organization.value.meta.packages.canStartWebshopsTrial) {
                    new Toast($t('Je hebt geen recht meer om een proefperiode op te starten. Je kan wel het pakket activeren. Neem contact op met Stamhoofd als je deze toch wilt gebruiken.'), 'error').show();
                    await openPackageDetails(pack);
                    return;
                }
                // Activate trial if possible (otherwise go to confirm)
                await checkoutTrial(STPackageBundle.TrialWebshops, $t('De proefperiode voor webshops is gestart. Neem je tijd om alles rustig uit te proberen. Als je het daarna definitief in gebruik wilt nemen, kan je het systeem activeren.'));
                await dismiss({ force: true });
                break;
            }
        }
        return;
    }
    await openPackageDetails(pack);
}

</script>
