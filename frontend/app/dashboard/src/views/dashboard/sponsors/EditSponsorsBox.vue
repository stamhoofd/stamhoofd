<template>
    <div class="container">
        <h2 class="style-with-button">
            <div>{{ $t('Sponsors') }}</div>
            <div>
                <button type="button" class="button icon add" @click="addSponsor" />
            </div>
        </h2>

        <p>{{ $t('Het is mogelijk om het logo van sponsors op je tickets te plaatsen.') }}</p>

        <STList v-model="draggableSponsors" :draggable="true">
            <template #item="{item: sponsor}">
                <STListItem :selectable="true" @click="editSponsor(sponsor)">
                    <h3 class="style-title-list">
                        {{ sponsor.name || 'Naamloos' }}
                    </h3>
                    <p v-if="sponsor.onTickets" class="style-description-small">
                        {{ $t('Op tickets') }}
                    </p>

                    <template #right>
                        <span class="button icon drag gray" @click.stop @contextmenu.stop />
                        <span class="icon arrow-right-small gray" />
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
