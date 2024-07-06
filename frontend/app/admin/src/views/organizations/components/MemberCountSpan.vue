<template>
    <span v-if="count !== null">{{ formatInteger(count) }}</span>
    <span v-else class="style-placeholder-skeleton" />
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { useContext } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { CountResponse, Organization } from '@stamhoofd/structures';
import { ref, watch } from 'vue';

const props = defineProps<{
    organization: Organization,
}>();
const context = useContext()
const count = ref(null as null | number);
const owner = useRequestOwner()

watch(() => props.organization.id, async () => {
    Request.cancelAll(owner);
    const response = await context.value.authenticatedServer.request({
        method: 'GET',
        path: `/members/count`,
        query: {
            filter: JSON.stringify({
                activeRegistrations: {
                    $elemMatch: {
                        organizationId: props.organization.id
                    }
                }
            })
        },
        decoder: CountResponse as Decoder<CountResponse>,
        owner
    })

    count.value = response.data.count;
}, { immediate: true });

</script>
