<template>
    <div id="members-activated-view" class="st-view background">
        <STNavigationBar title="Ledenadministratie is actief" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>Stel de ledenadministratie in</h1>

            <p>Via het ledenadministratie-pakket kan je leden vragen om online in te schrijven via jullie eigen ledenportaal, of kan je ze uitnodigen (<a :href="LocalizedDomains.marketingUrl +'/docs/hoe-schrijven-leden-in/'" class="inline-link" target="_blank">meer info</a>). Je kan gerust zelf eerst even proberen in te schrijven. Je kan testleden daarna terug verwijderen (gebruik wel een geldig e-mailadres).</p>

            <hr>
            <h2>1. Stel je lidstructuur in</h2>

            <p v-if="isYouth">
                Alle activiteiten, leeftijdsgroepen, kampen of andere groepen waarvoor leden kunnen inschrijven worden 'inschrijvingsgroepen' genoemd. Zo kunnen leden inschrijven voor activiteiten van jouw vereniging, maar ook bijvoorbeeld voor een volledig jaar, semester... Dat bepaal je zelf. Op het einde van een inschrijvingsperiode kan je per groep individueel een nieuwe inschrijvingsperiode starten waarna leden opnieuw moeten inschrijven, of je kan de activiteit archiveren.
            </p>
            <p v-else>
                In Stamhoofd worden leden opgedeeld in 'inschrijvingsgroepen'. Leden kunnen inschrijven voor één of meer van die groepen, of je schrijft ze er zelf in (importeren vanaf Excel of manueel). Zo kunnen leden inschrijven voor activiteiten van jouw vereniging, maar ook bijvoorbeeld voor een volledig jaar, semester... Dat bepaal je zelf. Op het einde van een inschrijvingsperiode kan je per groep individueel een nieuwe inschrijvingsperiode starten waarna leden opnieuw moeten inschrijven, of je kan de activiteit archiveren.
            </p>

            <button class="button secundary" type="button" @click="manageGroups">
                <span class="icon settings" />
                <span>Instellen</span>
            </button>

            <hr>
            <h2>2. Beslis welke gegevens je wilt verzamelen</h2>

            <p class="style-description-block">
                Je kan zelf kiezen welke informatie je wilt verzamelen van jouw leden (bv. geboortedatum, emailadres, telefoonnummer, eigen vragen...). Wijzig dit via de knop hieronder, of later via de instellingen.
            </p>

            <button class="button secundary" type="button" @click="manageRecords(true)">
                <span class="icon settings" />
                <span>Instellen</span>
            </button>

            <hr>
            <h2 class="style-with-button">
                <div>3. Bekijk je eigen ledenportaal</div>
                <div>
                    <a :href="organization.registerUrl" target="_blank" rel="noopener" class="button text">
                        <span class="icon external" />
                        <span class="hide-small">Openen</span>
                    </a>
                </div>
            </h2>

            <p>
                Leden kunnen inschrijven via jullie eigen ledenportaal of via een uitnodiging in een e-mail die je via Stamhoofd verstuurt (<a :href="LocalizedDomains.marketingUrl +'/docs/hoe-schrijven-leden-in/'" class="inline-link" target="_blank">meer info</a>). Plaats deze link bijvoorbeeld op je website.
            </p>

            <!-- todo: test -->
            <input v-tooltip="'Klik om te kopiëren'" v-copyable class="input" :value="organization.registerUrl" readonly>

            <p class="info-box">
                {{ $t('dashboard.settings.registrationPage.linkDescription') }}
            </p>

            <hr>
            <h2>4. Stel meer in via het tabblad 'Instellingen'</h2>
            <p>Je kan alle bovenstaande zaken en nog meer (zoals financiële ondersteuning, vrije bijdrages, betaalmethodes, leden importeren) op elk moment wijzigen, via het tabblad 'Instellingen' in het menu van Stamhoofd.</p>

            <hr>
            <h2>Handige links</h2>

            <STList>
                <STListItem :selectable="true" element-name="a" :href="'https://'+$t('shared.domains.marketing')+'/docs/'" target="_blank">
                    <template #left>
                        <span class="icon link" />
                    </template>
                    Documentatie
                </STListItem>

                <STListItem :selectable="true" element-name="a" :href="'https://'+$t('shared.domains.marketing')+'/docs/tag/ledenadministratie-instellen/'" target="_blank">
                    <template #left>
                        <span class="icon link" />
                    </template>
                    Ledenadministratie instellen
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="button" @click="dismiss()">
                    <span>Doorgaan</span>
                    <span class="icon arrow-right" />
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, useCanDismiss, useCanPop, useDismiss, usePresent } from '@simonbackx/vue-app-navigation';
import { STList, STListItem, STNavigationBar, STToolbar, useRequiredOrganization } from '@stamhoofd/components';
import { OrganizationRegistrationPeriod, OrganizationType } from '@stamhoofd/structures';

import { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import RecordsConfigurationView from '@stamhoofd/components/records/RecordsConfigurationView.vue';
import { usePatchOrganizationPeriods } from '@stamhoofd/networking';
import { computed } from 'vue';
import { LocalizedDomains } from '../../../../../../../../shared/i18n/LocalizedDomains';
import EditCategoryGroupsView from '../../../groups/EditCategoryGroupsView.vue';

const organization = useRequiredOrganization();
const present = usePresent();
const dismiss = useDismiss();
const canDismiss = useCanDismiss();
const canPop = useCanPop();
const patchOrganizationPeriods = usePatchOrganizationPeriods();

const period = computed(() => organization.value.period);
const rootCategory = computed(() => period.value.rootCategory);

const isYouth = organization.value.meta.type === OrganizationType.Youth;

function manageRecords(animated: boolean = true) {
    present(
        {
            components: [new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(RecordsConfigurationView, {}),
            })],
            modalDisplayStyle: 'popup',
            animated,
        }).catch(console.error);
}

async function manageGroups() {
    const component = new ComponentWithProperties(EditCategoryGroupsView, {
        organization: organization.value,
        category: rootCategory.value,
        periodId: period.value.id,
        // todo: is necesarry to get all periods?
        periods: [period.value],
        saveHandler: async (patch: PatchableArrayAutoEncoder<OrganizationRegistrationPeriod>) => {
            await patchOrganizationPeriods(patch);
        },
    });

    present({
        components: [new ComponentWithProperties(NavigationController, {
            root: component,
        })],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}
</script>
