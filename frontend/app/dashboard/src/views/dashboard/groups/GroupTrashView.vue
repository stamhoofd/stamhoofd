<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main>
            <h1>
                {{ title }}
            </h1>

            <p>
                Deze inschrijvingsgroepen werden verwijderd. Je kan ze terugzetten door ze aan te klikken.
            </p>

            <Spinner v-if="loadingGroups" />
            <STList v-else-if="groups.length">
                <STListItem v-for="group in groups" :key="group.id" :selectable="true" @click="restoreGroup($event, group)">
                    <template #left>
                        <GroupAvatar :group="group" />
                    </template>

                    <h2 class="style-title-list">
                        {{ group.settings.name }}
                    </h2>
                    <p v-if="group.deletedAt" class="style-description-small">
                        Verwijderd op {{ formatDate(group.deletedAt) }}
                    </p>

                    <template #right>
                        <span class="icon undo gray" />
                    </template>
                </STListItem>
            </STList>
            <p v-else class="info-box">
                De prullenmand is leeg.
            </p>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { CenteredMessage, ContextMenu, ContextMenuItem, GroupAvatar, Spinner, STList, STListItem, STNavigationBar, Toast, useContext } from '@stamhoofd/components';
import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import { Group, GroupCategory, GroupCategoryTree, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, Ref, ref } from 'vue';

const props = defineProps<{
    period: OrganizationRegistrationPeriod;
}>();

const organizatioPeriodId = props.period.id;
const periodId = props.period.period.id;

const loadingGroups = ref(true);
const groups: Ref<Group[]> = ref([]);
const title = computed(() => `${$t('0671f7d3-7089-4cde-b28b-79acb10bea28')} (${props.period.period.nameShort ?? '?'})`);
const context = useContext();
const organizationManager = useOrganizationManager();
const allCategories = computed(() => props.period.getCategoryTree({
    admin: true,
    permissions: context.value.auth.permissions,
}).getAllCategories().filter(c => c.categories.length === 0));
const owner = useRequestOwner();

load().catch(console.error);

function formatDate(date: Date) {
    return Formatter.dateTime(date);
}

async function load() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/organization/deleted-groups',
            decoder: new ArrayDecoder(Group as Decoder<Group>),
            owner,
        });

        groups.value = response.data.filter(g => g.periodId === periodId);
    }
    catch (e) {
        Toast.fromError(e).show();
    }
    loadingGroups.value = false;
}

async function restoreGroup(event: TouchEvent | MouseEvent | undefined, group: Group) {
    if (allCategories.value.length === 0) {
        const toast = Toast.error($t('3e9cdd5a-b614-4e2b-bc84-48566628a60f'));
        toast.show();
        return;
    }

    if (allCategories.value.length === 1) {
        await restoreTo(group, allCategories.value[0]);
        return;
    }

    const menu = new ContextMenu([
        allCategories.value.map(cat =>
            new ContextMenuItem({
                name: cat.settings.name,
                rightText: cat.groupIds.length + '',
                action: () => {
                    restoreTo(group, cat).catch(console.error);
                    return true;
                },
            }),
        ),
    ]);
    menu.show({ clickEvent: event }).catch(console.error);
}

async function restoreTo(group: Group, cat: GroupCategoryTree) {
    if (!(await CenteredMessage.confirm(`${group.settings.name} terugzetten naar ${cat.settings.name}?`, 'Ja, terugzetten'))) {
        return;
    }

    const settings = OrganizationRegistrationPeriodSettings.patch({});
    const catPatch = GroupCategory.patch({ id: cat.id });

    if (cat.groupIds.filter(id => id === group.id).length > 1) {
        // Not fixable, we need to set the ids manually
        const cleaned = cat.groupIds.filter(id => id !== group.id);
        cleaned.push(group.id);
        catPatch.groupIds = cleaned as any;
    }
    else {
        // We need to delete it to fix issues if it is still there
        catPatch.groupIds.addDelete(group.id);
        catPatch.groupIds.addPut(group.id);
    }

    settings.categories.addPatch(catPatch);

    const patch = OrganizationRegistrationPeriod.patch({
        id: organizatioPeriodId,
        settings,
    });

    patch.groups.addPatch(Group.patch({
        id: group.id,
        deletedAt: null,
    }));

    try {
        await organizationManager.value.patchPeriod(patch);
    }
    catch (e) {
        Toast.fromError(e).show();
    }

    load().catch(console.error);
}
</script>
