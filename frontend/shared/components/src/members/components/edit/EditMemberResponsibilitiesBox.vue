<template>
    <div class="container">
        <Title v-bind="$attrs" :title="title" />

        <ScrollableSegmentedControl v-model="selectedOrganization" :items="items" :labels="labels" v-if="!organization">
            <template #right>
                <button v-tooltip="'Kies andere groep'" class="button icon gray add" type="button" @click="searchOrganization" />
            </template>
        </ScrollableSegmentedControl>


        <STErrorsDefault :error-box="parentErrorBox" />
        <STErrorsDefault :error-box="errors.errorBox" />

        <p class="info-box" v-if="responsibilities.length === 0">
            Geen functies gevonden
        </p>

        <STList v-else>
            <STListItem v-for="responsibility of responsibilities" :key="responsibility.id" element-name="label" :selectable="true">
                <template #left>
                    <Checkbox :model-value="isResponsibilityEnabled(responsibility)" @update:model-value="setResponsibilityEnabled(responsibility, $event)" />
                </template>

                <h2 class="style-title-list">
                    {{ responsibility.name }}
                </h2>
                <p class="style-description-small" v-if="getResponsibilityEnabledDescription(responsibility)">
                    {{ getResponsibilityEnabledDescription(responsibility) }}
                </p>
                <p class="style-description-small">
                    {{ responsibility.description }}
                </p>
            </STListItem>
        </STList>
    </div>
</template>

<script setup lang="ts">
import { MemberResponsibility, MemberResponsibilityRecord, Organization, PlatformMember } from '@stamhoofd/structures';

import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, PopOptions, usePresent } from '@simonbackx/vue-app-navigation';
import { ScrollableSegmentedControl, SearchMemberOrganizationView, useAuth, useOrganization, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Ref, computed, ref } from 'vue';
import { ErrorBox } from '../../../errors/ErrorBox';
import { Validator } from '../../../errors/Validator';
import { useErrors } from '../../../errors/useErrors';
import { useValidation } from '../../../errors/useValidation';
import Title from './Title.vue';
import { Formatter } from '@stamhoofd/utility';

defineOptions({
    inheritAttrs: false
})

const props = defineProps<{
    member: PlatformMember,
    validator: Validator,
    parentErrorBox?: ErrorBox | null
}>()

const errors = useErrors({validator: props.validator});
const platform = usePlatform();
const organization = useOrganization();

const items = computed(() => {
    if (organization.value) {
        return [organization.value]
    }
    return [...props.member.organizations, null]
});

const responsibilities = computed(() => {
    if (selectedOrganization.value === null) {
        if (!auth.hasFullPlatformAccess()) {
            return []
        }
        return platform.value.config.responsibilities.filter(r => !r.assignableByOrganizations)
    }
    return platform.value.config.responsibilities.filter(r => r.assignableByOrganizations) 
})
const selectedOrganization = ref((items.value[0] ?? null) as any) as Ref<Organization|null>;
const $t = useTranslate();
const present = usePresent();
const auth = useAuth();


const labels = computed(() => {
    return items.value.map(o => o === null ? 'Koepel' : o.name)
});

const title = computed(() => {
    return "Functies van " + props.member.patchedMember.firstName
})

useValidation(errors.validator, () => {
    const se = new SimpleErrors()

    if (se.errors.length > 0) {
        errors.errorBox = new ErrorBox(se)
        return false
    }
    errors.errorBox = null

    return true
});

function addOrganization(organization: Organization) {
    props.member.insertOrganization(organization);
    selectedOrganization.value = organization;
}

async function searchOrganization() {
    await present({
        url: 'zoeken',
        components: [
            new ComponentWithProperties(SearchMemberOrganizationView, {
                title: $t('shared.responsibilities.searchOrganizationTitle'),
                member: props.member,
                selectOrganization: async (organization: Organization, pop: (options?: PopOptions) => Promise<void>) => {
                    addOrganization(organization)
                    await pop({force: true});
                }
            })
        ],
        modalDisplayStyle: "popup"
    })
}

function isResponsibilityEnabled(responsibility: MemberResponsibility) {
    return !!props.member.patchedMember.responsibilities.find(r => !r.endDate && r.responsibilityId === responsibility.id && r.organizationId === (selectedOrganization?.value?.id ?? null))
}

function getResponsibilityEnabledDescription(responsibility: MemberResponsibility) {
    const rr = props.member.member.responsibilities.find(r => !r.endDate && r.responsibilityId === responsibility.id && r.organizationId === (selectedOrganization?.value?.id ?? null))

    if (rr) {
        if (!rr.endDate) {
            return 'Van ' + Formatter.date(rr.startDate, true) + ' tot nu'
        }
        return 'Van ' + Formatter.date(rr.startDate, true) + ' tot ' + Formatter.date(rr.endDate, true)
    }

    return null;
}

function setResponsibilityEnabled(responsibility: MemberResponsibility, enabled: boolean) {
    if (enabled === isResponsibilityEnabled(responsibility)) {
        return;
    }

    if (enabled) {
        const originalEnabled = props.member.member.responsibilities.find(r => !r.endDate && r.responsibilityId === responsibility.id && r.organizationId === (selectedOrganization?.value?.id ?? null))

        if (originalEnabled) {
            // Restore original state
            const patch: PatchableArrayAutoEncoder<MemberResponsibilityRecord> = new PatchableArray()
            patch.addPatch(MemberResponsibilityRecord.patch({
                id: originalEnabled.id,
                endDate: null
            }))

            props.member.addPatch({
                responsibilities: patch
            })
            return;
        }

        // Create a new one
        const record = MemberResponsibilityRecord.create({
            memberId: props.member.id,
            responsibilityId: responsibility.id,
            startDate: new Date(),
            endDate: null,
            organizationId: selectedOrganization?.value?.id ?? null
        })

        const patch: PatchableArrayAutoEncoder<MemberResponsibilityRecord> = new PatchableArray()
        patch.addPut(record)

        props.member.addPatch({
            responsibilities: patch
        })
        return;
    }

    const current = props.member.patchedMember.responsibilities.find(r => !r.endDate && r.responsibilityId === responsibility.id && r.organizationId === (selectedOrganization?.value?.id ?? null))
    if (!current) {
        return;
    }
    const patch: PatchableArrayAutoEncoder<MemberResponsibilityRecord> = new PatchableArray()

    // Did we already have this?
    const originalEnabled = props.member.member.responsibilities.find(r => !r.endDate && r.responsibilityId === responsibility.id && r.organizationId === (selectedOrganization?.value?.id ?? null))
    if (originalEnabled && originalEnabled.id === current.id) {
        patch.addPatch(MemberResponsibilityRecord.patch({
            id: current.id,
            endDate: new Date()
        }))
    } else {
        patch.addDelete(current.id)
    }

    props.member.addPatch({
        responsibilities: patch
    })

}
</script>
