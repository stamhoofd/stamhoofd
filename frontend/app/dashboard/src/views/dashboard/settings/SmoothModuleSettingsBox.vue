<template>
    <div class="container">
        <SegmentedControl v-model="selectedItem" :items="items" :labels="labels" />
        <STList v-if="selectedItem === 'all' || selectedItem === 'webshops'" class="illustration-list">
            <STListItem :selectable="true" class="left-center" @click="createWebshop(WebshopType.Performance)">
                <template #left>
                    <img src="~@stamhoofd/assets/images/illustrations/stage.svg">
                </template>
                <h2 class="style-title-list smaller">
                    Zaalvoorstelling met tickets
                </h2>
                <p class="style-description-smaller">
                    Verkoop tickets met vaste plaatsen of vrije plaatsen voor een voorstelling, bv. een toneelstuk.
                </p>
                <template #right>
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>

            <STListItem :selectable="true" class="left-center" @click="createWebshop(WebshopType.Event)">
                <template #left>
                    <img src="~@stamhoofd/assets/images/illustrations/tickets.svg">
                </template>
                <h2 class="style-title-list smaller">
                    Evenement met tickets
                </h2>
                <p class="style-description-smaller">
                    Verkoop tickets en scan de QR-codes met onze app.
                </p>
                <template #right>
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>

            <STListItem :selectable="true" class="left-center" @click="createWebshop(WebshopType.Registrations)">
                <template #left>
                    <img src="~@stamhoofd/assets/images/illustrations/edit-data.svg">
                </template>
                <h2 class="style-title-list smaller">
                    Inschrijvingen voor (openbare) evenementen verzamelen
                </h2>
                <p class="style-description-smaller">
                    Je organiseert een eetfestijn, een quiz, ... Je wilt, zonder dat bezoekers moeten inloggen, snel inschrijvingen verzamelen.
                </p>
                <template #right>
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>

            <STListItem :selectable="true" class="left-center" @click="createWebshop(WebshopType.TakeawayAndDelivery)">
                <template #left>
                    <img src="~@stamhoofd/assets/images/illustrations/truck.svg">
                </template>
                <h2 class="style-title-list smaller">
                    Take-away en/of levering
                </h2>
                <p class="style-description-smaller">
                    Bv. verkoop zelfgemaakte spaghettisaus of kerstkaarten. Af te halen of te leveren.
                </p>
                <template #right>
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>

            <STListItem :selectable="true" class="left-center" @click="createWebshop(WebshopType.Webshop)">
                <template #left>
                    <img src="~@stamhoofd/assets/images/illustrations/cart.svg">
                </template>
                <h2 class="style-title-list smaller">
                    Een webshop bouwen
                </h2>
                <p class="style-description-smaller">
                    Bouw een webshop om producten te verkopen, bv. T-shirts.
                </p>
                <template #right>
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>

            <STListItem :selectable="true" class="left-center" @click="createWebshop(WebshopType.Donations)">
                <template #left>
                    <img src="~@stamhoofd/assets/images/illustrations/charity.svg">
                </template>
                <h2 class="style-title-list smaller">
                    Donaties of inzameling
                </h2>
                <p class="style-description-smaller">
                    Maak een webshop waarop mensen een gift kunnen doen aan de hand van een overschrijving of Bancontact.
                </p>
                <template #right>
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>
        <hr v-if="selectedItem === 'all'">
        <STList v-if="selectedItem === 'all' || selectedItem === 'members'" class="illustration-list">
            <STListItem :selectable="true" class="left-center" @click="setupMemberAdministration()">
                <template #left>
                    <img src="~@stamhoofd/assets/images/illustrations/team.svg">
                </template>
                <h2 class="style-title-list smaller">
                    Ledenadministratie gebruiken
                </h2>
                <p class="style-description-smaller">
                    Gegevens van leden online beheren, online inschrijvingen voor activiteiten voor leden en ledenportaal voor leden
                </p>
                <template #right>
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, useShow } from '@simonbackx/vue-app-navigation';
import { LoadComponent, SegmentedControl, STList, STListItem, Toast, useContext, useErrors, useRequiredOrganization } from '@stamhoofd/components';
import { OrganizationType, PackageCheckout, PackagePurchases, PaymentMethod, STPackageBundle, STPackageType, UmbrellaOrganization, WebshopType } from '@stamhoofd/structures';

import { ref } from 'vue';
import ActivatedView from './modules/members/ActivatedView.vue';
import MembersStructureSetupView from './modules/members/MembersStructureSetupView.vue';
import { useOrganizationPackages } from './packages/hooks/useOrganizationPackages';

const loadingModule = ref<STPackageType | null>(null);
const items = ['webshops', 'members'];
const labels = ['Verkoop', 'Ledenadministratie'];
const selectedItem = ref('webshops');
const organization = useRequiredOrganization();
const show = useShow();
const context = useContext();

const errors = useErrors();
const { reload } = useOrganizationPackages({ errors, onMounted: true });

function setupMemberAdministration() {
    if (organization.value.groups.length === 0 && organization.value.meta.type === OrganizationType.Youth && (!organization.value.meta.umbrellaOrganization || [UmbrellaOrganization.ChiroNationaal, UmbrellaOrganization.ScoutsEnGidsenVlaanderen].includes(organization.value.meta.umbrellaOrganization))) {
        // We have an automated flow for these organizations
        show({
            components: [
                new ComponentWithProperties(MembersStructureSetupView, {}),
            ],
        }).catch(console.error);
    }
    else {
        checkoutTrial(STPackageBundle.TrialMembers, 'Je kan nu de ledenadministratie uittesten.').then(() => {
            // Wait for the backend to fill in all the default categories and groups
            show({
                components: [
                    new ComponentWithProperties(ActivatedView, {}),
                ],
            }).catch(console.error);
        }).catch(console.error);
    }
}

async function createWebshop(type: WebshopType) {
    show({
        components: [
            (
                await LoadComponent(
                    () => import(/* webpackChunkName: "EditWebshopGeneralView" */ '../webshop/edit/EditWebshopGeneralView.vue'),
                    {
                        forceType: type,
                        beforeSaveHandler: async () => {
                            await checkoutTrial(STPackageBundle.TrialWebshops, '');
                        },
                    },
                    { instant: true },
                )
            ),
        ],
    }).catch(console.error);
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
</script>
