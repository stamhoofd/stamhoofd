<template>
    <div class="st-view charge-memberships-view">
        <STNavigationBar title="Aansluitingen aanrekenen" />

        <main class="center">
            <h1>
                Aansluitingen aanrekenen
            </h1>

            <p>
                Alle aansluitingen die (al dan niet automatisch) aan leden worden toegevoegd, worden pas toegevoegd aan het openstaande bedrag van een lokale groep na een manuele actie. Daarna kan een lokale groep het bedrag betalen via een online betaling in hun beheerdersportaal.
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

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
                <button class="button primary" type="button">
                    Aanrekenen
                </button>
            </p>
            <p class="style-description-small">
                Alle aansluitingen worden aan het openstaand bedrag toegevoegd. Hierna kunnen deze aansluitingen niet meer van een lid worden verwijderd.
            </p>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { ErrorBox, useContext, useErrors } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { ChargeMembershipsSummary } from '@stamhoofd/structures';
import { Ref, ref } from 'vue';

const errors = useErrors();
const summary = ref(null) as Ref<null | ChargeMembershipsSummary>
const context = useContext()
const owner = useRequestOwner()

reload().catch(console.error)

async function reload() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/admin/charge-memberships/summary',
            decoder: ChargeMembershipsSummary as Decoder<ChargeMembershipsSummary>,
            owner
        })
        summary.value = response.data;
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }
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
