<template>
    <div v-if="organization">
        <p v-if="!hideTrial && !shouldFilter('webshops') && organization.meta.packages.isWebshopsTrial" class="warning-box selectable with-button" @click="checkout(STPackageBundle.Webshops)">
            Je test momenteel de webshops functie. Je webshops staan nog in demo-modus. Activeer de functie om het echt in gebruik te nemen.

            <button class="button text" type="button">
                Activeren
            </button>
        </p>
    </div>
</template>

<script lang="ts" setup>
import { useOrganization } from '@stamhoofd/components';
import { STPackageBundle } from '@stamhoofd/structures';

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

function shouldFilter(type: 'members' | 'webshops') {
    if (props.filterTypes === null) {
        return false;
    }
    if (props.filterTypes !== type) {
        return true;
    }
    return false;
}

const organization = useOrganization();

function checkout(bundle: STPackageBundle) {
    // todo
}
</script>
