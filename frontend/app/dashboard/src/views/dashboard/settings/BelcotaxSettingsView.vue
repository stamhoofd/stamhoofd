<template>
    <div class="st-view" data-testid="belcotax-settings-view">
        <STNavigationBar :title="$t('Belcotax')" />

        <main>
            <h1>{{ $t('Belcotax') }}</h1>
            <p>{{ $t('Attesten kunnen verschillende organisatoren hebben, dus je verbindt per entiteit. Enkel een wettelijk vertegenwoordiger zoals gekend in de KBO kan verbinden, met itsme of eID.') }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <p v-if="companies.length === 0" class="info-box">
                {{ $t('Er zijn nog geen entiteiten ingesteld. Voeg ze toe bij de algemene instellingen.') }}
            </p>

            <Spinner v-else-if="loading" />

            <STList v-else>
                <STListItem v-for="item of companies" :key="item.company.id" data-testid="belcotax-company" :data-company-id="item.company.id">
                    <h3 class="style-title-list">
                        {{ item.company.name || $t('Naamloze entiteit') }}
                    </h3>
                    <p class="style-description-small">
                        {{ getDescription(item) }}
                    </p>

                    <template #right>
                        <span v-if="item.connection?.isValid" class="style-tag success">{{ $t('Verbonden') }}</span>
                        <LoadingButton v-else-if="item.companyNumber" :loading="connecting === item.company.id">
                            <button class="button text" type="button" data-testid="belcotax-connect" :disabled="connecting !== null" @click="connect(item.company)">
                                {{ item.connection ? $t('Opnieuw verbinden') : $t('Verbinden') }}
                            </button>
                        </LoadingButton>
                    </template>
                </STListItem>
            </STList>

            <p class="style-description-small">
                {{ $t('Een verbinding blijft geldig zolang ze minstens eens per week gebruikt wordt. Daarna meld je opnieuw aan, zonder nieuwe toestemming.') }}
            </p>
        </main>
    </div>
</template>

<script lang="ts" setup>
import type { Decoder } from '@common/encoding';
import { ArrayDecoder } from '@common/encoding';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useRequestOwner } from '@stamhoofd/components/hooks/networking/useRequestOwner';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import LoadingButton from '@stamhoofd/components/navigation/LoadingButton.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import Spinner from '@stamhoofd/components/Spinner.vue';
import type { Company } from '@stamhoofd/structures';
import { BelcotaxConnection, getBelcotaxCompanyNumber } from '@stamhoofd/structures/belcotax/BelcotaxConnection.js';
import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted, ref } from 'vue';
import { useBelcotaxConnect } from './useBelcotaxConnect';

type CompanyItem = {
    company: Company;
    companyNumber: string | null;
    connection: BelcotaxConnection | null;
};

const context = useContext();
const owner = useRequestOwner();
const errors = useErrors();
const organization = useRequiredOrganization();
const belcotaxConnect = useBelcotaxConnect();

const connections = ref<BelcotaxConnection[]>([]);
const loading = ref(true);
const connecting = ref<string | null>(null);

const companies = computed<CompanyItem[]>(() => organization.value.meta.companies.map((company) => {
    const companyNumber = getBelcotaxCompanyNumber(company);
    return {
        company,
        companyNumber,
        connection: companyNumber ? (connections.value.find(c => c.companyNumber === companyNumber) ?? null) : null,
    };
}));

function formatCompanyNumber(companyNumber: string) {
    return companyNumber.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1.$2.$3');
}

function getDescription(item: CompanyItem) {
    if (!item.companyNumber) {
        return $t('Geen ondernemingsnummer · enkel via bestand');
    }
    const kbo = formatCompanyNumber(item.companyNumber);
    if (!item.connection) {
        return $t('{kbo} · niet verbonden', { kbo });
    }
    if (!item.connection.isValid) {
        return $t('{kbo} · verbinding verlopen op {date}', { kbo, date: Formatter.date(item.connection.validUntil, true) });
    }
    return $t('{kbo} · verbonden door {name} · geldig tot {date}', {
        kbo,
        name: item.connection.representativeName,
        date: Formatter.date(item.connection.validUntil, true),
    });
}

async function load() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/organization/belcotax/connections',
            decoder: new ArrayDecoder(BelcotaxConnection as Decoder<BelcotaxConnection>),
            owner,
            shouldRetry: false,
        });
        connections.value = response.data;
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    } finally {
        loading.value = false;
    }
}

async function connect(company: Company) {
    if (connecting.value) {
        return;
    }
    connecting.value = company.id;
    errors.errorBox = null;

    try {
        await belcotaxConnect.connect(company.id);
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
        connecting.value = null;
    }
}

onMounted(() => {
    belcotaxConnect.checkResult().catch(console.error);
    load().catch(console.error);
});
</script>
