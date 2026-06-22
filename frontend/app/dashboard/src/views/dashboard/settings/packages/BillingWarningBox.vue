<template>
    <div v-if="organization && !$isPlatform">
        <p v-if="isPaymentFailed && paymentFailedDeactivateDate" class="error-box selectable with-button" @click="openBilling">
            {{ $t('%1Ut', { date: formatEndDate(paymentFailedDeactivateDate) }) }}

            <button class="button text" type="button">
                {{ $t('%1V8') }}
            </button>
        </p>

        <p v-if="!shouldFilter('webshops') && hasExpired(webshopDeactivateDate)" class="error-box selectable with-button" @click="openPackages">
            {{ $t('%1Ud') }}

            <button class="button text" type="button">
                {{ $t('%1Lz') }}
            </button>
        </p>

        <p v-if="!isPaymentFailed && !shouldFilter('webshops') && isNearing(webshopDeactivateDate) && webshopDeactivateDate" class="warning-box selectable with-button" @click="openPackages">
            {{ $t('%1Vk', { date: formatEndDate(webshopDeactivateDate) }) }}

            <button class="button text" type="button">
                {{ $t('%1Lz') }}
            </button>
        </p>

        <p v-if="!hideTrial && !shouldFilter('webshops') && organization.meta.packages.isWebshopsTrial" class="secundary-box selectable with-button icon trial" @click="openPackages">
            {{ $t('%1cy') }}

            <button class="button text" type="button">
                {{ $t('%1Lx') }}
            </button>
        </p>

        <p v-if="!hideTrial && !shouldFilter('members') && organization.meta.packages.isMembersTrial" class="secundary-box selectable with-button icon trial" @click="openPackages">
            {{ $t('%1Yd') }}

            <button class="button text" type="button">
                {{ $t('%1Lx') }}
            </button>
        </p>

        <p v-if="!shouldFilter('members') && hasExpired(membersDeactivateDate)" class="error-box selectable with-button" @click="openPackages">
            {{ $t('%1Up') }}

            <button class="button text" type="button">
                {{ $t('%1Lz') }}
            </button>
        </p>

        <p v-if="!isPaymentFailed && !shouldFilter('members') && isNearing(membersDeactivateDate) && membersDeactivateDate" class="warning-box selectable with-button" @click="openPackages">
            {{ $t('%1bh', { date: formatEndDate(membersDeactivateDate) }) }}

            <button class="button text" type="button">
                {{ $t('%1Lz') }}
            </button>
        </p>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { AccessRight, STPackageType } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useLoadPayableBalance } from '../hooks/useLoadPayableBalance';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform';

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

async function openPackages() {
    if (!auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)) {
        new CenteredMessage(
            $t('%1YB'),
            $t('%1ct'),
        ).addCloseButton().show();
        return;
    }
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('./PackageSettingsView.vue'), {}),
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
            $t('%1YB'),
            $t('%1dC'),
        ).addCloseButton().show();
        return;
    }

    try {
        const item = await loadPayableBalance(platform.value.membershipOrganizationId);
        await present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: AsyncComponent(() => import('../BillingSettingsView.vue'), { item }),
                }),
            ],
            modalDisplayStyle: 'popup',
        });
    } catch (e) {
        Toast.fromError(e).show();
    }
}
</script>
