<template>
    <div v-if="organization && !$isPlatform">
        <p v-if="isPaymentFailed && paymentFailedDeactivateDate" class="error-box selectable with-button" @click="openBilling">
            {{ $t('Jouw betaling via domiciliëring/kredietkaart is mislukt. Breng de betaling zelf in orde via "Meer → Boekhouding → Openstaand bedrag" voor {date} om te voorkomen dat sommige functies tijdelijk onbeschikbaar worden.', { date: formatEndDate(paymentFailedDeactivateDate) }) }}

            <button class="button text" type="button">
                {{ $t('Nakijken') }}
            </button>
        </p>

        <p v-if="!shouldFilter('webshops') && hasExpired(webshopDeactivateDate)" class="error-box selectable with-button" @click="openPackages">
            {{ $t('Jouw webshops pakket is vervallen. Verleng jouw pakket om jouw webshops te heractiveren en te vermijden dat je gegevens verliest.') }}

            <button class="button text" type="button">
                {{ $t('Verlengen') }}
            </button>
        </p>

        <p v-if="!isPaymentFailed && !shouldFilter('webshops') && isNearing(webshopDeactivateDate) && webshopDeactivateDate" class="warning-box selectable with-button" @click="openPackages">
            {{ $t('Jouw webshops worden automatisch uitgeschakeld vanaf {date}. Verleng jouw pakket om de webshop module langer in gebruik te houden.', { date: formatDateTime(webshopDeactivateDate) }) }}

            <button class="button text" type="button">
                {{ $t('Verlengen') }}
            </button>
        </p>

        <p v-if="!hideTrial && !shouldFilter('webshops') && organization.meta.packages.isWebshopsTrial" class="secundary-box selectable with-button icon trial" @click="openPackages">
            {{ $t('Je test momenteel de webshops functie. Je webshops staan nog in demo-modus. Activeer de functie om het echt in gebruik te nemen.') }}

            <button class="button text" type="button">
                {{ $t('Activeren') }}
            </button>
        </p>

        <p v-if="!shouldFilter('members') && organization.meta.packages.isMembersTrial" class="secundary-box selectable with-button icon trial" @click="openPackages">
            {{ $t('Je test momenteel de ledenadministratie functie. Je ledenportaal staat nog in demo-modus. Activeer de functie om het echt in gebruik te nemen.') }}

            <button class="button text" type="button">
                {{ $t('Activeren') }}
            </button>
        </p>

        <p v-if="!shouldFilter('members') && hasExpired(membersDeactivateDate)" class="error-box selectable with-button" @click="openPackages">
            {{ $t('Het ledenadministratie pakket is vervallen. Verleng jouw pakket om ervoor te zorgen dat leden terug kunnen inschrijven, en om te voorkomen dat gegevens verloren zullen gaan.') }}

            <button class="button text" type="button">
                {{ $t('Verlengen') }}
            </button>
        </p>

        <p v-if="!isPaymentFailed && !shouldFilter('members') && isNearing(membersDeactivateDate) && membersDeactivateDate" class="warning-box selectable with-button" @click="openPackages">
            {{ $t('De ledenadministratie wordt uitgeschakeld vanaf {date}. Verleng jouw pakket om onderbreking van online inschrijvingen en het bekijken van gegevens te voorkomen.', { date: formatEndDate(membersDeactivateDate) }) }}

            <button class="button text" type="button">
                {{ $t('Verlengen') }}
            </button>
        </p>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { AccessRight, STPackageType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import BillingSettingsView from '../BillingSettingsView.vue';
import { useLoadPayableBalance } from '../hooks/useLoadPayableBalance';
import PackageSettingsView from './PackageSettingsView.vue';
import { usePlatform } from '@stamhoofd/components';

const props = withDefaults(
    defineProps<{
        filterTypes?: 'members' | 'webshops' | null;
        hideTrial?: boolean;
    }>(),
    {
        filterTypes: null,
        hideTrial: false,
    },
);

const organization = useOrganization();
const platform = usePlatform();
const auth = useAuth();
const present = usePresent();
const loadPayableBalance = useLoadPayableBalance();

function shouldFilter(type: 'members' | 'webshops') {
    if (props.filterTypes === null) {
        return false;
    }
    return props.filterTypes !== type;
}

const packageTypeList = computed(() => {
    if (props.filterTypes === null) {
        return Object.values(STPackageType);
    }
    const types: STPackageType[] = [];

    if (!shouldFilter('members')) {
        types.push(STPackageType.Members, STPackageType.LegacyMembers);
    }

    if (!shouldFilter('webshops')) {
        types.push(STPackageType.Webshops, STPackageType.SingleWebshop);
    }

    return types;
});

const paymentFailedDeactivateDate = computed(() => {
    if (!organization.value) {
        return null;
    }
    let result: Date | null = null;
    for (const [type, pack] of organization.value.meta.packages.packages) {
        if (!packageTypeList.value.includes(type)) {
            continue;
        }
        if (pack.deactivateDate === null || pack.firstFailedPayment === null) {
            continue;
        }
        if (result && result < pack.deactivateDate) {
            continue;
        }
        result = pack.deactivateDate;
    }
    return result;
});

const isPaymentFailed = computed(() => paymentFailedDeactivateDate.value !== null);

const webshopDeactivateDate = computed(() => {
    if (!organization.value) {
        return null;
    }
    let result: Date | null = null;
    for (const [type, pack] of organization.value.meta.packages.packages) {
        if (type !== STPackageType.Webshops && type !== STPackageType.SingleWebshop) {
            continue;
        }
        if (pack.removeAt && pack.removeAt <= new Date()) {
            continue;
        }
        if (pack.deactivateDate === null) {
            return null;
        }
        if (result && result > pack.deactivateDate) {
            continue;
        }
        result = pack.deactivateDate;
    }
    return result;
});

const membersDeactivateDate = computed(() => {
    if (!organization.value) {
        return null;
    }
    let result: Date | null = null;
    for (const [type, pack] of organization.value.meta.packages.packages) {
        if (type !== STPackageType.Members && type !== STPackageType.LegacyMembers) {
            continue;
        }
        if (pack.removeAt && pack.removeAt <= new Date()) {
            continue;
        }
        if (pack.deactivateDate === null) {
            return null;
        }
        if (result && result > pack.deactivateDate) {
            continue;
        }
        result = pack.deactivateDate;
    }
    return result;
});

function isNearing(date: Date | null) {
    if (date === null || hasExpired(date)) {
        return false;
    }
    return (date.getTime() - new Date().getTime()) < 1000 * 60 * 60 * 24 * 31;
}

function hasExpired(date: Date | null) {
    if (date === null) {
        return false;
    }
    return date <= new Date();
}

function formatDateTime(date: Date) {
    return Formatter.dateTime(date);
}

async function openPackages() {
    if (!auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)) {
        new CenteredMessage(
            $t('Enkel voor hoofdbeheerders'),
            $t('Het aanpassen van pakketten is enkel beschikbaar voor hoofdbeheerders. Vraag hen om de verlenging in orde te brengen.'),
        ).addCloseButton().show();
        return;
    }
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(PackageSettingsView),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function openBilling() {
    if (!organization.value || !platform.value.membershipOrganizationId) {
        return;
    }
    if (!auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)) {
        new CenteredMessage(
            $t('Enkel voor hoofdbeheerders'),
            $t('Betalingen zijn enkel beschikbaar voor hoofdbeheerders. Vraag hen om de betaling in orde te brengen.'),
        ).addCloseButton().show();
        return;
    }

    try {
        const item = await loadPayableBalance(platform.value.membershipOrganizationId);
        await present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(BillingSettingsView, { item }),
                }),
            ],
            modalDisplayStyle: 'popup',
        });
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}
</script>
