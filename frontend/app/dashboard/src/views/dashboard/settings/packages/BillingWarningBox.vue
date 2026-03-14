<template>
    <div>
        <p v-if="!hasBillingCallback && paymentFailedDeactivateDate" class="error-box selectable with-button" @click="openBilling">
            Jouw betaling via domiciliëring/kredietkaart is mislukt. Breng de betaling zelf in orde via 'Boekhouding → Openstaand bedrag' voor {{ Formatter.dateTime(paymentFailedDeactivateDate) }} om te voorkomen dat sommige functies tijdelijk onbeschikbaar worden.

            <button class="button text" type="button">
                Nakijken
            </button>
        </p>
        <p v-else-if="hasBillingCallback && paymentFailedDeactivateDate" class="error-box selectable with-button" @click="openBilling">
            Jouw betaling via domiciliëring/kredietkaart is mislukt. Breng de betaling zelf in orde voor {{ Formatter.dateTime(paymentFailedDeactivateDate) }} om te voorkomen dat sommige functies tijdelijk onbeschikbaar worden.

            <button class="button text" type="button">
                Openen
            </button>
        </p>

        <p v-if="!shouldFilter('webshops') && hasExpired(webshopDeactivateDate)" class="error-box selectable with-button" @click="openPackages">
            Jouw webshops pakket is vervallen. Verleng jouw pakket om jouw webshops te heractiveren en te vermijden dat je gegevens verliest.

            <button class="button text" type="button">
                Verlengen
            </button>
        </p>

        <p v-if="!isPaymentFailed && !shouldFilter('webshops') && webshopDeactivateDate && isNearing(webshopDeactivateDate)" class="warning-box selectable with-button" @click="openPackages">
            Jouw webshops worden automatisch uitgeschakeld vanaf {{ Formatter.dateTime(webshopDeactivateDate) }}. Verleng jouw pakket om de webshop module langer in gebruik te houden.

            <button class="button text" type="button">
                Verlengen
            </button>
        </p>

        <p v-if="!hideTrial && !shouldFilter('webshops') && isWebshopsTrial" class="warning-box selectable with-button" @click="checkout(STPackageBundle.Webshops)">
            Je test momenteel de webshops functie. Je webshops staan nog in demo-modus. Activeer de functie om het echt in gebruik te nemen.

            <button class="button text" type="button">
                Activeren
            </button>
        </p>

        <p v-if="!shouldFilter('members') && isMembersTrial" class="warning-box selectable with-button" @click="checkout(STPackageBundle.Members)">
            Je test momenteel de ledenadministratie functie. Je ledenportaal staan nog in demo-modus. Activeer de functie om het echt in gebruik te nemen.

            <button class="button text" type="button">
                Activeren
            </button>
        </p>

        <p v-if="!shouldFilter('members') && hasExpired(membersDeactivateDate)" class="error-box selectable with-button" @click="openPackages">
            Het ledenadministratie pakket is vervallen. Verleng jouw pakket om ervoor te zorgen dat leden terug kunnen inschrijven, en om te voorkomen dat gegevens verloren zullen gaan.

            <button class="button text" type="button">
                Activeren
            </button>
        </p>

        <p v-if="!isPaymentFailed && !shouldFilter('members') && membersDeactivateDate && isNearing(membersDeactivateDate)" class="warning-box selectable with-button" @click="openPackages">
            De ledenadministratie wordt uitgeschakeld vanaf {{ Formatter.dateTime(membersDeactivateDate) }}. Verleng jouw pakket om onderbreking van online inschrijvingen en het bekijken van gegevens te voorkomen.

            <button class="button text" type="button">
                Verlengen
            </button>
        </p>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, LoadComponent, useAuth } from '@stamhoofd/components';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { AccessRight, STPackageBundle, STPackageType } from '@stamhoofd/structures';

import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import PackageConfirmView from './PackageConfirmView.vue';
import PackageSettingsView from './PackageSettingsView.vue';

const props = withDefaults(
    defineProps<{
        filterTypes?: 'members' | 'webshops' | null;
        hideTrial?: boolean;
        billing?: () => void;
    }>(),
    {
        filterTypes: null,
        hideTrial: false,
        billing: undefined,
    },
);

function shouldFilter(type: 'members' | 'webshops') {
    if (props.filterTypes === null) {
        return false;
    }
    if (props.filterTypes !== type) {
        return true;
    }
    return false;
}

const organization = useRequiredOrganization();

const present = usePresent();
const show = useShow();
const auth = useAuth();

const hasBillingCallback = props.billing !== undefined;

const isWebshopsTrial = computed(() => organization.value.meta.packages.isWebshopsTrial);

const isMembersTrial = computed(() => organization.value.meta.packages.isMembersTrial);

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
    let d: Date | null = null;
    for (const [type, pack] of organization.value.meta.packages.packages) {
        if (!packageTypeList.value.includes(type)) {
            continue;
        }
        if (pack.deactivateDate === null || pack.firstFailedPayment === null) {
            continue;
        }
        if (d && d < pack.deactivateDate) {
            continue;
        }
        d = pack.deactivateDate;
    }
    return d;
});

const isPaymentFailed = computed(() => paymentFailedDeactivateDate.value !== null);

const webshopDeactivateDate = computed(() => {
    let d: Date | null = null;
    for (const [type, pack] of organization.value.meta.packages.packages) {
        if (type === STPackageType.Webshops || type === STPackageType.SingleWebshop) {
            if (pack.removeAt && pack.removeAt <= new Date()) {
                continue;
            }

            if (pack.deactivateDate === null) {
                return null;
            }
            if (d && d > pack.deactivateDate) {
                continue;
            }
            d = pack.deactivateDate;
        }
    }
    return d;
});

const membersDeactivateDate = computed(() => {
    let d: Date | null = null;
    for (const [type, pack] of organization.value.meta.packages.packages) {
        if (type === STPackageType.Members || type === STPackageType.LegacyMembers) {
            if (pack.removeAt && pack.removeAt <= new Date()) {
                continue;
            }
            if (pack.deactivateDate === null) {
                return null;
            }
            if (d && d > pack.deactivateDate) {
                continue;
            }
            d = pack.deactivateDate;
        }
    }
    return d;
});

/**
     * Return if date is in less than 2 weeks
     */
function isNearing(date: Date | null) {
    if (hasExpired(date)) {
        return false;
    }

    if (date === null) {
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

function checkout(bundle: STPackageBundle) {
    present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(PackageConfirmView, {
                    bundles: [bundle],
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

function openPackages() {
    if (!auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)) {
        // todo: change text?
        new CenteredMessage('Enkel voor hoofdbeheerders', 'Het aanpassen van pakketten is enkel beschikbaar voor hoofdbeheerders. Vraag hen om de verlenging in orde te brengen.').addCloseButton().show();
        return;
    }
    present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(PackageSettingsView),
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

async function openBilling() {
    if (props.billing) {
        props.billing();
        return;
    }

    if (!auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)) {
        // todo: change text?
        new CenteredMessage('Enkel voor hoofdbeheerders', 'Betalingen zijn enkel beschikbaar voor hoofdbeheerders. Vraag hen om de betaling in orde te brengen.').addCloseButton().show();
        return;
    }
    show({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: await LoadComponent(() => import(/* webpackChunkName: "FinancesView" */ '../FinancesView.vue'), {}, { instant: false }),
            }),
        ],
        animated: true,
    }).catch(console.error);
}
</script>
