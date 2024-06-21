<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <STErrorsDefault :error-box="errors.errorBox" />

        <STList>
            <SelectOrganizationTagRow v-for="tag in tags" :key="tag.id" :organization="patched" :tag="tag" @patch:organization="addPatch" />
        </STList>
    </SaveView>
</template>

<script lang="ts" setup>
import { ArrayDecoder, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, Toast, useContext, useErrors, usePatch, usePlatform } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { Organization } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import SelectOrganizationTagRow from './components/SelectOrganizationTagRow.vue';

const platform = usePlatform();
const errors = useErrors();
const pop = usePop();
const owner = useRequestOwner();
const context = useContext();

const props = defineProps<{
    organization: Organization
}>()

const tags = computed(() => platform.value.config.tags)
const {patched, hasChanges, addPatch, patch} = usePatch(props.organization)

const saving = ref(false);

const title = 'Tags wijzigen'

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    try {
        const arr: PatchableArrayAutoEncoder<Organization> = new PatchableArray();
        patch.value.id = props.organization.id;
        arr.addPatch(patch.value);
        
        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/admin/organizations',
            body: arr,
            shouldRetry: false,
            owner,
            decoder: new ArrayDecoder(Organization as Decoder<Organization>)
        });
        new Toast('De wijzigingen zijn opgeslagen', "success green").show()

        // Copy updated data into already loaded objects in the system
        const updatedData = response.data.find(d => d.id === props.organization.id)
        
        if (updatedData) {
            props.organization.set(updatedData)
        }
        await pop({ force: true });
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }

    saving.value = false;

}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
}

defineExpose({
    shouldNavigateAway
})
</script>
