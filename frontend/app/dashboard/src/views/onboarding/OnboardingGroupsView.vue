<template>
    <SaveView :title="title" :save-text="$t('Volgende')" save-icon-right="arrow-right" :loading="saving" :prefer-large-button="true" @save="goNext">
        <aside class="style-title-prefix">
            {{ $t('Stap {current} van {total}', { current: props.stepNumber.toString(), total: props.stepCount.toString() }) }}
        </aside>
        <h1>
            {{ title }}
        </h1>
        <p>
            {{ $t('Maak hier snel jullie leeftijdsgroepen of onderverdelingen aan. Vul gewoon de namen in, je kan dit later nog verfijnen.') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList>
            <STListItem v-for="(row, index) in rows" :key="row.key" class="onboarding-group-row no-padding" element-name="div">
                <template #left>
                    <span v-if="index < rows.length - 1" class="icon small team gray" />
                    <span v-else class="icon small add gray" />
                </template>

                <input
                    v-model="row.name"
                    type="text"
                    autocomplete="off"
                    enterkeyhint="next"
                    class="onboarding-group-row-input"
                    :placeholder="index === rows.length - 1 ? $t('Voeg een groep toe') : $t('Naam van de groep')"
                >

                <template #right>
                    <button v-if="index < rows.length - 1" class="button icon small trash gray" type="button" @click="deleteRow(row)" />
                </template>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script setup lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions';
import { usePatchOrganizationPeriod } from '@stamhoofd/networking/hooks/usePatchOrganizationPeriod';
import { GroupCategory, GroupSettings, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings, TranslatedString } from '@stamhoofd/structures';
import { Group } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';
import { onActivated, ref, watch } from 'vue';
import { getSuggestedGroupNames } from './onboardingGroupSuggestions';
import type { OnboardingStepProps } from './useMemberAdministrationOnboarding';

type GroupRow = {
    key: string;
    groupId: string | null;
    name: string;
};

const props = defineProps<OnboardingStepProps>();
const navigationActions = useNavigationActions();
const patchOrganizationPeriod = usePatchOrganizationPeriod();
const errors = useErrors();
const saving = ref(false);

const title = $t('Welke onderverdelingen heb je?');

const viewModel = props.viewModel;

function makeRow(groupId: string | null = null, name = ''): GroupRow {
    return { key: uuidv4(), groupId, name };
}

// Initialize the rows from the existing groups, or from suggestions when there are none yet.
let existingGroups = viewModel.membershipGroups;
const rows = ref<GroupRow[]>(
    existingGroups.length > 0
        ? existingGroups.map(g => makeRow(g.id, g.settings.name.toString()))
        : getSuggestedGroupNames(viewModel.organization.meta.type, viewModel.organization.meta.umbrellaOrganization).map(name => makeRow(null, name)),
);

onActivated(() => {
    existingGroups = viewModel.membershipGroups;
    rows.value = viewModel.membershipGroups.map(g => makeRow(g.id, g.settings.name.toString()));
});

// Track existing groups the user removed, so we can delete them on save.
const deletedGroupIds = ref<string[]>([]);

// Always keep one empty trailing row that acts as the "add" field.
function ensureTrailingEmpty() {
    const last = rows.value[rows.value.length - 1];
    if (!last || last.name.trim().length > 0) {
        rows.value.push(makeRow());
    }
}
ensureTrailingEmpty();
watch(() => rows.value[rows.value.length - 1]?.name, ensureTrailingEmpty);

async function deleteRow(row: GroupRow) {
    if (row.groupId) {
        const group = existingGroups.find(g => g.id === row.groupId);
        if (!await CenteredMessage.confirm({
            title: $t('Ben je zeker dat je de groep ‘{groupName}’ en bijhorende gegevens wilt verwijderen?', { groupName: group?.settings.name.toString() ?? row.name }),
            confirmText: $t('Ja, verwijderen'),
            destructive: true,
        })) {
            return;
        }
        deletedGroupIds.value.push(row.groupId);
    }
    rows.value = rows.value.filter(r => r.key !== row.key);
    ensureTrailingEmpty();
}

async function goNext() {
    if (saving.value) {
        return;
    }
    saving.value = true;
    errors.errorBox = null;

    try {
        const namedRows = rows.value.filter(r => r.name.trim().length > 0);

        if (namedRows.length === 0 && deletedGroupIds.value.length === 0) {
            throw new SimpleError({
                code: 'no_groups',
                message: $t('Voeg minstens één groep toe.'),
            });
        }

        const periodPatch = OrganizationRegistrationPeriod.patch({ id: viewModel.period.id });
        const settings = OrganizationRegistrationPeriodSettings.patch({});

        // New groups: create them and add them to the main category.
        const mainCategory = viewModel.getMainCategory();
        const categoryPatch = GroupCategory.patch({ id: mainCategory.id });
        let hasNewGroups = false;

        for (const row of namedRows) {
            if (row.groupId) {
                // Existing group: patch the name if it changed.
                const group = existingGroups.find(g => g.id === row.groupId);
                if (group && group.settings.name.toString() !== row.name.trim()) {
                    periodPatch.groups.addPatch(Group.patch({
                        id: group.id,
                        settings: GroupSettings.patch({ name: TranslatedString.create(row.name.trim()) }),
                    }));
                }
                continue;
            }

            const group = viewModel.createGroup(row.name.trim());
            periodPatch.groups.addPut(group);
            categoryPatch.groupIds.addPut(group.id);
            row.groupId = group.id;
            hasNewGroups = true;
        }

        // Deleted groups: remove them and clean up the categories that reference them.
        for (const groupId of deletedGroupIds.value) {
            periodPatch.groups.addDelete(groupId);
            for (const category of viewModel.period.settings.categories) {
                if (category.groupIds.includes(groupId)) {
                    const pp = GroupCategory.patch({ id: category.id });
                    pp.groupIds.addDelete(groupId);
                    settings.categories.addPatch(pp);
                }
            }
        }

        if (hasNewGroups) {
            settings.categories.addPatch(categoryPatch);
        }

        periodPatch.settings = settings;

        await patchOrganizationPeriod(viewModel.period, periodPatch);
        deletedGroupIds.value = [];

        await props.saveHandler(navigationActions);
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    } finally {
        saving.value = false;
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.onboarding-group-row-input {
    padding: 0 10px;
    height: 50px;
    line-height: 50px;
    @extend .style-input;
    width: 100%;
    box-sizing: border-box;
    margin-left: -10px;
    border-radius: $border-radius;
    background-color: $color-background;
    transition: background 0.2s;
    border: $border-width solid transparent;
    z-index: 20;
    position: relative;
    transform: translate3d(0, 0, 0); // display above lines

    &:hover {
        background-color: $color-background-shade;
    }

    &:focus {
        background-color: $color-background;
        @extend .style-input-box;
    }
}
</style>
