<template>
    <div class="st-view background">
        <STNavigationBar title="Mijn paketten" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>
                Functionaliteiten activeren
            </h1>

            <STErrorsDefault :error-box="errors.errorBox" />

            <Spinner v-if="loadingStatus && status === null" />
            <template v-else>
                <p v-if="availablePackages.length === 0" class="info-box">
                    <span>Geweldig! Je hebt gebruikt momenteel alle functies. Meer info over alle prijzen kan je terugvinden op <a :href="'https://'+$t('shared.domains.marketing')+'/prijzen'" class="inline-link" target="_blank">onze website</a>.</span>
                </p>

                <template v-else>
                    <p class="style-description-block">
                        Kies de functies die je wilt activeren. Meer info over alle prijzen kan je terugvinden op <a :href="'https://'+$t('shared.domains.marketing')+'/prijzen'" class="inline-link" target="_blank">onze website</a>.
                    </p>

                    <STList>
                        <STListItem v-for="pack of availablePackages" :key="pack.bundle" element-name="button" :selectable="true" class="right-stack" @click="checkout(pack)">
                            <template #left>
                                <figure class="style-image-with-icon" :class="{gray: !pack.alreadyBought && !pack.inTrial, 'secundary': !pack.alreadyBought && pack.inTrial}">
                                    <figure>
                                        <span class="icon group" />
                                    </figure>

                                    <aside>
                                        <span v-if="pack.alreadyBought" v-tooltip="'Deze functie is actief'" class="icon success small primary" />
                                        <span v-else-if="pack.inTrial" v-tooltip="'Momenteel in proefperiode, activeer om in gebruik te nemen'" class="icon trial small stroke secundary" />
                                    </aside>
                                </figure>
                            </template>

                            <p v-if="pack.alreadyBought && pack.expiresSoon" class="style-title-prefix-list">
                                Vervalt binnenkort
                            </p>

                            <p v-else-if="pack.alreadyBought" class="style-title-prefix-list">
                                Actief
                            </p>

                            <h3 class="style-title-list">
                                {{ pack.title }}
                            </h3>

                            <p v-if="pack.alreadyBought && pack.package.validUntil" class="style-description-small">
                                Geldig tot {{ Formatter.endDate(pack.package.validUntil) }}
                            </p>

                            <p class="style-description-small">
                                {{ pack.description }}
                            </p>

                            <template #right>
                                <!-- todo -->
                                <p v-if="pack.inTrial && !pack.alreadyBought" class="style-title-prefix-list theme-secundary">
                                    In proefperiode
                                    <button v-if="pack.inTrial && !pack.alreadyBought" v-tooltip="'Stop proefperiode'" type="button" class="button icon small disabled selected" @click.stop="stopTrial(pack)" />
                                </p>

                                <span v-if="!pack.alreadyBought && (pack.inTrial || !pack.canStartTrial)" class="button text selected">
                                    <span>Activeren</span>
                                    <span class="icon arrow-right-small" />
                                </span>
                                <span v-if="!pack.alreadyBought && !pack.inTrial && pack.canStartTrial" class="button text selected">
                                    <span>Uitproberen</span>
                                    <span class="icon arrow-right-small" />
                                </span>
                                <span v-if="pack.alreadyBought && pack.expiresSoon && pack.package.meta.allowRenew" class="button text selected">
                                    <span>Verlengen</span>
                                    <span class="icon arrow-right-small" />
                                </span>
                                <span v-else-if="pack.alreadyBought" class="button icon arrow-right-small" />
                            </template>
                        </STListItem>
                    </STList>
                </template>
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, useCanDismiss, useCanPop, useDismiss, useShow } from '@simonbackx/vue-app-navigation';
import flagIcon from '@stamhoofd/assets/images/illustrations/package-activities.svg';
import groupIcon from '@stamhoofd/assets/images/illustrations/package-members.svg';
import experimentIcon from '@stamhoofd/assets/images/illustrations/package-trial.svg';
import cartIcon from '@stamhoofd/assets/images/illustrations/package-webshops.svg';
import { CenteredMessage, ErrorBox, Spinner, STErrorsDefault, STList, STListItem, STNavigationBar, Toast, useContext, useErrors, useRequiredOrganization } from '@stamhoofd/components';
import { UrlHelper, useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import { OrganizationType, PaymentMethod, STBillingStatus, STInvoiceResponse, STPackage, STPackageBundle, STPackageBundleHelper, STPackageType, UmbrellaOrganization } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onActivated, onMounted, Ref, ref, watch } from 'vue';
import PackageConfirmView from './PackageConfirmView.vue';
import PackageDetailsView from './PackageDetailsView.vue';
import { SelectablePackage } from './SelectablePackage';

const show = useShow();
const dismiss = useDismiss();
const canDismiss = useCanDismiss();
const canPop = useCanPop();
const errors = useErrors();
const context = useContext();
const organizationManager = useOrganizationManager();
const organization = useRequiredOrganization();
const owner = useRequestOwner();

const loadingStatus = ref(true);
const loading = ref(false);
const status = ref<STBillingStatus | null>(null);
const availablePackages: Ref<SelectablePackage[]> = ref([] as SelectablePackage[]);

onMounted(() => {
    UrlHelper.setUrl('/finances/packages');
    reload().catch((e) => {
        console.error(e);
    });
});

onActivated(() => {
    reload().catch((e) => {
        console.error(e);
    });
});

const hasSelected = computed(() => availablePackages.value.find(p => p.selected));

watch(() => status.value, () => {
    updatePackages();
});

function getPackageIcon(pack: STPackage): string | null {
    switch (pack.meta.type) {
        case STPackageType.Members: {
            if (status.value && status.value.packages.find(p => p.meta.type === STPackageType.LegacyMembers)) {
                return flagIcon;
            }
            return groupIcon;
        }
        case STPackageType.LegacyMembers: return groupIcon;
        case STPackageType.TrialMembers: return experimentIcon;
        case STPackageType.TrialWebshops: return experimentIcon;
        case STPackageType.Webshops: return cartIcon;
        case STPackageType.SingleWebshop: return cartIcon;
        default: return null;
    }
}

function updatePackages() {
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

        for (const p of status.value!.packages) {
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
            const pack = boughtPackage ?? STPackageBundleHelper.getCurrentPackage(bundle, new Date());
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
    availablePackages.value = packages;
}

async function reload() {
    loadingStatus.value = true;

    try {
        status.value = await organizationManager.value.loadBillingStatus({
            owner,
        });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    loadingStatus.value = false;
}

function checkout(pack: SelectablePackage) {
    if (pack.alreadyBought) {
        show(new ComponentWithProperties(PackageDetailsView, {
            pack: pack.package,
        })).catch(console.error);
        return;
    }

    if (pack.inTrial || !pack.canStartTrial) {
        show(new ComponentWithProperties(PackageConfirmView, {
            bundles: [pack.bundle],
        })).catch(console.error);
    }
    else {
        switch (pack.bundle) {
            case STPackageBundle.Members: {
                if (!organization.value.meta.packages.canStartMembersTrial) {
                    new Toast('Je hebt geen recht meer om een proefperiode op te starten. Je kan wel het pakket activeren. Neem contact op met Stamhoofd als je deze toch wilt gebruiken.', 'error').show();
                    show(new ComponentWithProperties(PackageConfirmView, {
                        bundles: [pack.bundle],
                    })).catch(console.error);
                    return;
                }
                // Activate trial if possible (otherwise go to confirm)
                setupMemberAdministration();
                break;
            }
            case STPackageBundle.Webshops: {
                if (!organization.value.meta.packages.canStartWebshopsTrial) {
                    new Toast('Je hebt geen recht meer om een proefperiode op te starten. Je kan wel het pakket activeren. Neem contact op met Stamhoofd als je deze toch wilt gebruiken.', 'error').show();
                    show(new ComponentWithProperties(PackageConfirmView, {
                        bundles: [pack.bundle],
                    })).catch(console.error);
                    return;
                }
                // Activate trial if possible (otherwise go to confirm)
                checkoutTrial(STPackageBundle.TrialWebshops, 'De proefperiode voor webshops is gestart. Neem je tijd om alles rustig uit te proberen. Als je het daarna definitief in gebruik wilt nemen, kan je het systeem activeren.')
                    .then(() => {
                        dismiss().catch(console.error);
                    })
                    .catch(console.error);
                break;
            }
        }
    }
}

async function stopTrial(pack: SelectablePackage) {
    if (pack.alreadyBought) {
        return;
    }

    if (!pack.inTrial) {
        return;
    }
    switch (pack.bundle) {
        case STPackageBundle.Members: {
            if (!await CenteredMessage.confirm('Ben je zeker dat je de proefperiode voor de ledenadministratie wilt stopzetten?', 'Ja, stopzetten')) {
                return;
            }
            // Activate trial if possible (otherwise go to confirm)
            deactivate(STPackageType.TrialMembers, 'Proefperiode stopgezet').catch(console.error);
            break;
        }
        case STPackageBundle.Webshops: {
            if (!await CenteredMessage.confirm('Ben je zeker dat je de proefperiode voor webshops wilt stopzetten?', 'Ja, stopzetten')) {
                return;
            }

            // Activate trial if possible (otherwise go to confirm)
            deactivate(STPackageType.TrialWebshops, 'Proefperiode stopgezet').catch(console.error);
            break;
        }
    }
}

const loadingModule: Ref<STPackageType | null> = ref(null);

function setupMemberAdministration() {
    // todo
    if (organization.value.meta.type === OrganizationType.Youth && organization.value.meta.umbrellaOrganization && [UmbrellaOrganization.ChiroNationaal, UmbrellaOrganization.ScoutsEnGidsenVlaanderen].includes(organization.value.meta.umbrellaOrganization)) {
        // We have an automated flow for these organizations
        show({
            components: [
                new ComponentWithProperties(MembersStructureSetupView, {}),
            ],
        }).catch(console.error);
    }
    else {
        checkoutTrial(STPackageBundle.TrialMembers, 'De proefperiode voor ledenadministratie is gestart. Neem je tijd om alles rustig uit te proberen. Als je het daarna definitief in gebruik wilt nemen, kan je het systeem activeren.').then(() => {
            // Wait for the backend to fill in all the default categories and groups
            show({
                components: [
                    new ComponentWithProperties(ActivatedView, {}),
                ],
            }).catch(console.error);
        }).catch(console.error);
    }
}

async function checkoutTrial(bundle: STPackageBundle, message: string) {
    if (loadingModule.value) {
        new Toast('Even geduld, nog bezig met laden...', 'info').show();
        return;
    }
    loadingModule.value = bundle as any as STPackageType;

    try {
        await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/billing/activate-packages',
            body: {
                bundles: [bundle],
                paymentMethod: PaymentMethod.Unknown,
            },
            decoder: STInvoiceResponse as Decoder<STInvoiceResponse>,
            shouldRetry: false,
        });
        // todo
        await context.value.fetchOrganization(false);
        await reload();
        new Toast(message, 'success green').show();
    }
    catch (e) {
        Toast.fromError(e).show();
    }

    loadingModule.value = null;
}

async function deactivate(type: STPackageType, message: string) {
    if (loadingModule.value) {
        return;
    }
    loadingModule.value = type;

    try {
        const status = await organizationManager.value.loadBillingStatus({
            shouldRetry: false,
            owner,
        });
        const packages = status.packages;
        const pack = packages.find(p => p.meta.type === type);

        if (pack) {
            await context.value.authenticatedServer.request({
                method: 'POST',
                path: '/billing/deactivate-package/' + pack.id,
                owner,
                shouldRetry: false,
            });
            // todo
            await context.value.fetchOrganization(false);
            await reload();
            new Toast(message, 'success green').show();
        }
        else {
            // Update out of date
            // todo
            await context.value.fetchOrganization(false);
        }
    }
    catch (e) {
        Toast.fromError(e).show();
    }

    loadingModule.value = null;
}

const shouldNavigateAway = async () => {
    if (loading.value) {
        return false;
    }
    return true;
};

defineExpose({
    shouldNavigateAway,
});
</script>
