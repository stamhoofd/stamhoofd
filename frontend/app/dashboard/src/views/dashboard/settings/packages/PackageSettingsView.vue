<template>
    <LoadingViewTransition :error-box="errors.errorBox">
        <div v-if="status" class="st-view background">
            <STNavigationBar :title="$t('Functionaliteiten activeren')" />

            <main>
                <h1>
                    {{ $t('Functionaliteiten activeren') }}
                </h1>

                <p class="style-description-block">
                    <I18nComponent :t="$t(' Kies de functies die je wilt activeren. Meer info over alle prijzen kan je terugvinden op <button>onze website</button>')">
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
                            <IconContainer icon="group" :class="{gray: !pack.alreadyBought && !pack.inTrial, 'secundary': !pack.alreadyBought && pack.inTrial}">
                                <template #aside>
                                    <span v-if="pack.alreadyBought" v-tooltip="'Deze functie is actief'" class="icon success small primary" />
                                    <span v-else-if="pack.inTrial" v-tooltip="'Momenteel in proefperiode, activeer om in gebruik te nemen'" class="icon trial small stroke secundary" />
                                </template>
                            </IconContainer>
                        </template>

                        <p v-if="pack.inTrial && !pack.alreadyBought" class="style-title-prefix-list theme-secundary">
                            <span>{{ $t('In proefperiode') }}</span>
                            <button v-if="pack.inTrial && !pack.alreadyBought" v-tooltip="$t('Stop proefperiode')" type="button" class="button icon small disabled selected" @click.stop="stopTrial(pack)" />
                        </p>

                        <p v-if="pack.alreadyBought && pack.expiresSoon" class="style-title-prefix-list">
                            {{ $t('Vervalt binnenkort') }}
                        </p>

                        <p v-else-if="pack.alreadyBought" class="style-title-prefix-list">
                            {{ $t('Actief') }}
                        </p>

                        <h3 class="style-title-list">
                            {{ pack.title }}
                        </h3>

                        <p v-if="pack.alreadyBought && pack.package.validUntil" class="style-description-small">
                            {{ $t('Geldig tot {dateTime}', {dateTime: formatDateTime(pack.package.validUntil)}) }}
                        </p>

                        <p class="style-description-small">
                            {{ pack.description }}
                        </p>

                        <template #right>
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
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { ErrorBox, useContext, useErrors, useRequiredOrganization, IconContainer } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { OrganizationPackagesStatus, STPackage, STPackageBundle, STPackageBundleHelper } from '@stamhoofd/structures';
import { onMounted, ref, Ref, watch } from 'vue';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n';

const status = ref(null) as Ref<OrganizationPackagesStatus | null>;
const errors = useErrors();
const organization = useRequiredOrganization();
const packages = ref([] as SelectablePackage[]);
const loadingStatus = ref(false);
const owner = useRequestOwner();
const context = useContext();

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

onMounted(() => {
    reload().catch(console.error);
});

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
    return packages;
}

async function reload() {
    if (loadingStatus.value) {
        return;
    }
    loadingStatus.value = true;

    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/organization/packages',
            owner,
            decoder: OrganizationPackagesStatus as Decoder<OrganizationPackagesStatus>,
        });

        status.value = response.data;
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    loadingStatus.value = false;
}

async function stopTrial(pack: SelectablePackage) {
    // todo
}

async function checkout(pack: SelectablePackage) {
    // todo
}

</script>
