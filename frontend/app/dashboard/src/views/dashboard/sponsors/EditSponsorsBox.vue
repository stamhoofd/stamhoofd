<template>
    <div class="container">
        <h2 class="style-with-button">
            <div>{{ $t('190073b3-d692-46a7-925d-908f99a1139b') }}</div>
            <div>
                <button type="button" class="button icon add" @click="addSponsor"/>
            </div>
        </h2>

        <p>{{ $t('398c833d-d2af-477f-bed7-4862cd5dc9a7') }}</p>

        <STList v-model="draggableSponsors" :draggable="true">
            <template #item="{item: sponsor}">
                <STListItem :selectable="true" @click="editSponsor(sponsor)">
                    <h3 class="style-title-list">
                        {{ sponsor.name || 'Naamloos' }}
                    </h3>
                    <p v-if="sponsor.onTickets" class="style-description-small">
                        {{ $t('8ecdf993-08e2-4f13-99c4-2121b56ee23a') }}
                    </p>

                    <template #right>
                        <span class="button icon drag gray" @click.stop @contextmenu.stop/>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>
            </template>
        </STList>
    </div>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { STList, STListItem } from '@stamhoofd/components';
import { Sponsor, SponsorConfig } from '@stamhoofd/structures';

import { computed } from 'vue';
import EditSponsorView from './EditSponsorView.vue';

const props = defineProps<{
    config: SponsorConfig | null;
}>();

const emits = defineEmits<{
    (e: 'patch', patch: AutoEncoderPatchType<SponsorConfig> | null): void;
}>();

const present = usePresent();
const sponsors = computed(() => props.config?.sponsors ?? []);

function patchConfig(patch: AutoEncoderPatchType<SponsorConfig> | null) {
    if (patch && !props.config) {
        const newPatch = SponsorConfig.create({}).patch(patch) as unknown as AutoEncoderPatchType<SponsorConfig>;
        emits('patch', newPatch);
        return;
    }
    emits('patch', patch);
}

function addSponsor() {
    const sponsor = Sponsor.create({});
    const patch = SponsorConfig.patch({});
    patch.sponsors.addPut(sponsor);

    present({
        components: [
            new ComponentWithProperties(EditSponsorView, {
                sponsor,
                isNew: true,
                saveHandler: (p: AutoEncoderPatchType<Sponsor>) => {
                    p.id = sponsor.id;
                    patch.sponsors.addPatch(p);
                    patchConfig(patch);
                },
            }),
        ],
        modalDisplayStyle: 'sheet',
    }).catch(console.error);
}

function editSponsor(sponsor: Sponsor) {
    present({
        components: [
            new ComponentWithProperties(EditSponsorView, {
                sponsor,
                isNew: false,
                saveHandler: (p: AutoEncoderPatchType<Sponsor>) => {
                    const patch = SponsorConfig.patch({});
                    p.id = sponsor.id;
                    patch.sponsors.addPatch(p);
                    patchConfig(patch);
                },
                deleteHandler: () => {
                    const patch = SponsorConfig.patch({});
                    patch.sponsors.addDelete(sponsor.id);
                    patchConfig(patch);
                },
            }),
        ],
        modalDisplayStyle: 'sheet',
    }).catch(console.error);
}

const draggableSponsors = computed({
    get: () => sponsors.value,
    set: (value: Sponsor[]) => {
        if (value.length !== sponsors.value.length) {
            return;
        }

        const patch = SponsorConfig.patch({
            sponsors: value as any,
        });
        patchConfig(patch);
    } });
</script>
