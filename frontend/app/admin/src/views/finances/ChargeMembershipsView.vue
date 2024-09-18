<template>
    <LoadingView v-if="loadingOrganization " :error-box="loadingOrganizationErrorBox" />
    <div v-else class="st-view charge-memberships-view">
        <STNavigationBar title="Aansluitingen aanrekenen" />

        <main class="center">
            <h1>
                Aansluitingen aanrekenen
            </h1>

            <p>
                Alle aansluitingen die (al dan niet automatisch) aan leden worden toegevoegd, worden pas toegevoegd aan het openstaande bedrag van een lokale groep na een manuele actie. Daarna kan een lokale groep het bedrag betalen via een online betaling in hun beheerdersportaal.
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <p v-if="summary && summary.running" class="info-box icon clock">
                Er is momenteel een aanrekening bezig. Wacht tot deze is afgelopen.
            </p>
            <template v-else>
                <div class="style-stats-grid">
                    <STInputBox title="Nieuwe aansluitingen">
                        <p class="style-price-big">
                            <span v-if="!summary" class="style-placeholder-skeleton" />
                            <span v-else>
                                {{ formatInteger(summary.memberships) }}
                            </span>
                        </p>
                    </STInputBox>

                    <STInputBox title="Unieke leden">
                        <p class="style-price-big">
                            <span v-if="!summary" class="style-placeholder-skeleton" />
                            <span v-else>
                                {{ formatInteger(summary.members) }}
                            </span>
                        </p>
                    </STInputBox>
                    
                    <STInputBox title="Totaal bedrag">
                        <p class="style-price-big">
                            <span v-if="!summary" class="style-placeholder-skeleton" />
                            <span v-else>
                                {{ formatPrice(summary.price) }}
                            </span>
                        </p>
                    </STInputBox>


                    <STInputBox title="Unieke groepen">
                        <p class="style-price-big">
                            <span v-if="!summary" class="style-placeholder-skeleton" />
                            <span v-else>
                                {{ formatInteger(summary.organizations) }}
                            </span>
                        </p>
                    </STInputBox>
                </div>

                <p class="style-button-bar">
                    <LoadingButton :loading="charging">
                        <button class="button primary" type="button" @click="charge">
                            Aanrekenen
                        </button>
                    </LoadingButton>
                </p>
                <p class="style-description-small">
                    Alle aansluitingen worden aan het openstaand bedrag toegevoegd. Hierna kunnen deze aansluitingen niet meer van een lid worden verwijderd.
                </p>

                <hr>
                <h2>
                    Verantwoordelijke groep voor aanrekeningen
                </h2>
                <p>
                    De aansluitingkosten worden altijd aangerekend via een groep die de koepel vertegenwoordigt. De betaalinstellingen en facturatiegegevens van die groep worden gebruikt voor het verzamelen van alle betalingen. Op die manier kan je de beschikbare betaalmethodes en betaalaccounts configureren.
                </p>

                <p v-if="membershipOrganization" class="info-box">
                    Gebruik de boekhoudmodule van deze groep om een zicht te krijgen op alle betalingen.
                </p>

                <STList v-if="membershipOrganization">
                    <STListItem :selectable="true" @click="chooseMembershipOrganization">
                        <template #left>
                            <OrganizationAvatar :organization="membershipOrganization" />
                        </template>

                        <h3 class="style-title-list">
                            {{ membershipOrganization.name }}
                        </h3>

                        <template #right>
                            <span class="button text">
                                Wijzig
                                <span class="icon arrow-right-small" />
                            </span>
                        </template>
                    </STListItem>
                </STList>
                <p v-else class="warning-box with-button selectable" @click="chooseMembershipOrganization">
                    Er is nog geen verantwoordelijke groep ingesteld. Kies een groep die verantwoordelijk is voor het verzamelen van de aansluitingskosten.

                    <button class="button text" type="button">
                        Instellen
                    </button>
                </p>

                <p v-if="hasChanges" class="style-button-bar">
                    <LoadingButton :loading="saving">
                        <button class="button primary" type="button" @click="save">
                            Opslaan
                        </button>
                    </LoadingButton>
                </p>

                <div v-for="type of platform.config.membershipTypes" :key="type.id" class="container">
                    <hr>
                    <h2>Detail "{{ type.name }}"</h2>

                    <div class="style-stats-grid">
                        <STInputBox title="Aantal">
                            <p class="style-price-big">
                                <span v-if="!summary" class="style-placeholder-skeleton" />
                                <span v-else>
                                    {{ formatInteger(getSummaryForType(type).memberships) }}
                                </span>
                            </p>
                        </STInputBox>

                        <STInputBox title="Unieke leden">
                            <p class="style-price-big">
                                <span v-if="!summary" class="style-placeholder-skeleton" />
                                <span v-else>
                                    {{ formatInteger(getSummaryForType(type).members) }}
                                </span>
                            </p>
                        </STInputBox>
                        
                        <STInputBox title="Totaal bedrag">
                            <p class="style-price-big">
                                <span v-if="!summary" class="style-placeholder-skeleton" />
                                <span v-else>
                                    {{ formatPrice(getSummaryForType(type).price) }}
                                </span>
                            </p>
                        </STInputBox>


                        <STInputBox title="Unieke groepen">
                            <p class="style-price-big">
                                <span v-if="!summary" class="style-placeholder-skeleton" />
                                <span v-else>
                                    {{ formatInteger(getSummaryForType(type).organizations) }}
                                </span>
                            </p>
                        </STInputBox>
                    </div>
                </div>
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { CenteredMessage, ErrorBox, OrganizationAvatar, Toast, useContext, useErrors, useExternalOrganization, useInterval, usePatch, usePlatform } from '@stamhoofd/components';
import { usePlatformManager, useRequestOwner } from '@stamhoofd/networking';
import { ChargeMembershipsSummary, ChargeMembershipsTypeSummary, PlatformMembershipType } from '@stamhoofd/structures';
import { computed, onActivated, Ref, ref } from 'vue';

const errors = useErrors();
const summary = ref(null) as Ref<null | ChargeMembershipsSummary>
const context = useContext()
const owner = useRequestOwner()
const platform = usePlatform();
const {patch, patched, addPatch, hasChanges, reset} = usePatch(platform)
const platformManager = usePlatformManager()
const saving = ref(false)
const charging = ref(false)
let loading = false;

const {externalOrganization: membershipOrganization, choose: $chooseMembershipOrganization, loading: loadingOrganization, errorBox: loadingOrganizationErrorBox} = useExternalOrganization(
    computed({
        get: () => patched.value.membershipOrganizationId,
        set: (membershipOrganizationId) => addPatch({
            membershipOrganizationId
        })
    })
)

useInterval(reload, 10 * 1000)

onActivated(() => {
    reload().catch(console.error)
})

const chooseMembershipOrganization = () => {
    return $chooseMembershipOrganization('Kies een vereniging die verantwoordelijk is voor het verzamelen van de aansluitingskosten')
}

async function save() {
    if (saving.value) {
        return
    }
    saving.value = true
    try {
        await platformManager.value.patch(patch.value, false)
        reset()
        Toast.success('Wijziging opgeslagen').show()
    } catch (e) {
        Toast.fromError(e).show()
    }
    saving.value = false
}


async function reload() {
    if (loading) {
        return
    }

    try {
        loading = true;
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/admin/charge-memberships/summary',
            decoder: ChargeMembershipsSummary as Decoder<ChargeMembershipsSummary>,
            owner,
            shouldRetry: true
        })
        summary.value = response.data;
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }
    loading = false;
}

async function charge() {
    if (charging.value) {
        return
    }
    if (!await CenteredMessage.confirm('Weet je zeker dat je alle aansluitingen wilt aanrekenen?', 'Ja, aanrekenen')) {
        return
    }

    charging.value = true
    try {
        await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/admin/charge-memberships',
            owner
        })
        Toast.success('Aansluitingen worden aangerekend. Het kan even duren voor deze overal verschijnen.').show()
        await reload()
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }
    charging.value = false
}

function getSummaryForType(type: PlatformMembershipType): ChargeMembershipsTypeSummary {
    if (!summary.value) {
        return ChargeMembershipsTypeSummary.create({});
    }
    return summary.value.membershipsPerType.get(type.id) ?? ChargeMembershipsTypeSummary.create({})
}

</script>

<style lang="scss">
.charge-memberships-view {
    .style-stats-grid {
        padding: 15px 0;
    }

    .style-button-bar {
        padding-top: 15px;
        padding-bottom: 5px;
    }
}
</style>
