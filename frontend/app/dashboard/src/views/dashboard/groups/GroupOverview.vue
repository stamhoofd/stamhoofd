<template>
    <div id="webshop-overview" class="st-view background">
        <STNavigationBar :title="title"/>

        <main>
            <h1 class="style-navigation-title">
                {{ title }}

                <span v-if="group.settings.period" class="title-suffix">
                    {{ group.settings.period.nameShort }}
                </span>
            </h1>
            <p v-if="isLocked" class="warning-box">
                {{ $t('7dd9a44e-8a47-4b74-9d57-d20b1efb706f') }}
            </p>
            <p v-if="!isPublic" class="info-box">
                {{ $t('8678523e-92c1-427d-8fdd-62f1ff58c6aa') }}
            </p>
            <p v-if="!isArchive && !isOpen" class="info-box">
                {{ $t('3d43c2bd-0cfd-495e-a0c3-7545b63a66ce') }} <template v-if="hasFullPermissions">
                    {{ $t('2f80767f-4fd2-41c2-b476-d4353c514f5b') }}
                </template>
            </p>

            <BillingWarningBox filter-types="members" class="data-table-prefix"/>

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center right-stack" @click="navigate(Routes.Members)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/group.svg"></template>
                    <h2 class="style-title-list">
                        {{ $t('c252fbf3-d038-4cee-a1b3-9c84a54644fd') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('20da7617-2d90-4e9f-841d-3151ef0e7f14') }}
                    </p>
                    <template #right>
                        <span v-if="group.getMemberCount() !== null" class="style-description-small">{{ formatInteger(group.getMemberCount()!) }}</span>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>

                <STListItem v-if="group.waitingList" :selectable="true" class="left-center right-stack" @click="navigate(Routes.WaitingList)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/clock.svg"></template>
                    <h2 class="style-title-list">
                        {{ $t('505f83e9-65b8-4484-9595-9cdac499a9d2') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('bf1453dd-489b-4cdd-8a6c-f61c1ffd0340') }}
                    </p>
                    <template #right>
                        <span v-if="group.waitingList.getMemberCount() !== null" class="style-description-small">{{ formatInteger(group.waitingList.getMemberCount()!) }}</span>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>

                <STListItem v-for="responsibility of linkedResponsibilities" :key="responsibility.id" :selectable="true" class="left-center right-stack" @click="openResponsibility(responsibility)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/responsibility.svg"></template>
                    <h2 class="style-title-list">
                        {{ responsibility.name }} van {{ group.settings.name }}
                    </h2>
                    <p class="style-description">
                        {{ $t('0109ab23-ef98-4799-a2f8-b49d7578c55b') }}
                    </p>

                    <template #right>
                        <MemberCountSpan :filter="getResponsibilityFilter(responsibility)" class="style-description-small"/>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>
            </STList>

            <template v-if="hasFullPermissions">
                <hr><h2>{{ $t('a370eff9-c1c1-450c-8bdb-dcee89bd2f70') }}</h2>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="editGeneral(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/flag.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('f8ce21aa-06de-4373-874c-ddad1629cad8') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('26f488f7-9329-46c4-9912-ad8db06260d4') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editPermissions(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/lock.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('5f64bf27-51c6-427b-b92a-8dd8d3c3cfae') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('dcb0e8f9-8d0d-4d43-b4e8-3df3226e7f4c') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editPage(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/palette.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t("f1ac1789-bc6c-40e4-8327-0295fafe48ab") }}
                        </h2>
                        <p class="style-description">
                            {{ $t('28b10608-dac5-4fbc-b152-2ae3256207e0') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editEmails(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/email-template.svg"></template>
                        <h2 class="style-title-list">
                            {{ $t('e4e79acd-2538-406e-927c-e18c5383a493') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('31aeb45a-47d7-48c0-b6ad-985c44268fde') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>
                </STList>

                <hr><h2>{{ $t('8424a02d-2147-40d1-9db2-ddece074a650') }}</h2>

                <STList>
                    <STListItem v-if="!isArchive && !isOpen" :selectable="true" @click="openGroup()">
                        <h2 class="style-title-list">
                            {{ $t('064ac7fd-c416-445e-bff1-8a8263610bf3') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('cb257e72-aba4-419b-96ed-bfe586930220') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary green hide-smartphone">
                                <span class="icon power"/>
                                <span>{{ $t('e8ddc6ce-fe87-42dd-847a-892d17a029a0') }}</span>
                            </button>
                            <button type="button" class="button icon power only-smartphone"/>
                        </template>
                    </STListItem>

                    <STListItem v-if="!isArchive && isOpen" :selectable="true" @click="closeGroup()">
                        <h2 class="style-title-list">
                            {{ $t('88d51521-4938-4048-9477-e3b10f97d1e4') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('4bea5d5b-3632-49e3-aefc-b2956a6029eb') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary danger hide-smartphone">
                                <span class="icon power"/>
                                <span>{{ $t('08919911-1157-400d-b89c-265233590019') }}</span>
                            </button>
                            <button type="button" class="button icon power only-smartphone"/>
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" @click="deleteGroup()">
                        <h2 class="style-title-list">
                            {{ $t('81232fe7-6956-4e0f-868e-f34acd4c396b') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('c30f782e-c2b3-4b0c-8686-500a3c9af57e') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary danger hide-smartphone">
                                <span class="icon trash"/>
                                <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
                            </button>
                            <button type="button" class="button icon trash only-smartphone"/>
                        </template>
                    </STListItem>
                </STList>
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, defineRoutes, NavigationController, useNavigate, useNavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ContextMenu, ContextMenuItem, EditEmailTemplatesView, EditGroupView, EditResourceRolesView, MemberCountSpan, MembersTableView, PromiseView, STList, STListItem, STNavigationBar, Toast, useAuth, useOrganization, usePlatform } from '@stamhoofd/components';
import { useOrganizationManager } from '@stamhoofd/networking';
import { EmailTemplateType, Group, GroupCategory, GroupCategoryTree, GroupSettings, GroupStatus, MemberResponsibility, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings, PermissionLevel, PermissionsResourceType } from '@stamhoofd/structures';

import { Formatter } from '@stamhoofd/utility';
import { ComponentOptions, computed } from 'vue';
import BillingWarningBox from '../settings/packages/BillingWarningBox.vue';
import EditGroupPageView from './edit/EditGroupPageView.vue';

const props = defineProps<{
    group: Group;
    period: OrganizationRegistrationPeriod;
}>();

const isPublic = computed(() => props.group.isPublic(props.period.availableCategories));
const title = computed(() => props.group.settings.name);
const isArchive = computed(() => props.group.status === GroupStatus.Archived);
const isOpen = computed(() => !props.group.closed);
const auth = useAuth();
const hasFullPermissions = computed(() => auth.canAccessGroup(props.group, PermissionLevel.Full));
const organizationManager = useOrganizationManager();
const organization = useOrganization();
const navigationController = useNavigationController();
const present = usePresent();
const isLocked = computed(() => props.period.period.locked);
const platform = usePlatform();

enum Routes {
    Members = 'Members',
    WaitingList = 'WaitingList',
    Responsibility = 'Responsibility',
}

defineRoutes([
    {
        url: 'inschrijvingen',
        name: Routes.Members,
        component: MembersTableView as ComponentOptions,
        paramsToProps: () => {
            return {
                group: props.group,
            };
        },
    },
    {
        url: 'wachtlijst',
        name: Routes.WaitingList,
        component: MembersTableView as ComponentOptions,
        paramsToProps: () => {
            if (!props.group.waitingList) {
                throw new Error('No waiting list');
            }
            return {
                group: props.group.waitingList,
            };
        },
    },
    {
        url: '/r/@slug',
        name: Routes.Responsibility,
        params: {
            slug: String,
        },
        component: MembersTableView as ComponentOptions,
        paramsToProps(params: { slug: string }) {
            const responsibility = linkedResponsibilities.value.find(r => Formatter.slug(r.name) === params.slug);

            if (!responsibility) {
                throw new Error('Responsibility not found');
            }

            return {
                responsibility,
                customTitle: responsibility.name + ' (' + props.group.settings.name + ')',
                customFilter: getResponsibilityFilter(responsibility),
            };
        },
        propsToParams(props) {
            if (!('responsibility' in props)) {
                throw new Error('Missing responsibility');
            }

            return {
                params: {
                    slug: Formatter.slug((props.responsibility as MemberResponsibility).name as string),
                },
            };
        },
    },
]);

const navigate = useNavigate();
const linkedResponsibilities = computed(() => {
    if (props.group.defaultAgeGroupId === null) {
        return [];
    }

    if (!auth.hasFullAccess()) {
        return [];
    }

    const id = props.group.defaultAgeGroupId;
    return platform.value.config.responsibilities.filter(r => r.defaultAgeGroupIds !== null && r.defaultAgeGroupIds.includes(id) && (r.organizationTagIds === null || organization.value?.meta.matchTags(r.organizationTagIds)));
});

function getResponsibilityFilter(responsibility: MemberResponsibility) {
    return {
        responsibilities: {
            $elemMatch: {
                responsibilityId: responsibility.id,
                group: {
                    id: props.group.id,
                },
                endDate: null,
            },
        },
    };
}

async function openResponsibility(responsibility: MemberResponsibility) {
    await navigate(Routes.Responsibility, {
        params: {
            slug: Formatter.slug(responsibility.name),
        },
    });
}

async function displayEditComponent(component: any, animated = true) {
    const displayedComponent = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(PromiseView, {
            promise: async () => {
                try {
                    // Make sure we have an up to date group
                    await organizationManager.value.forceUpdate();
                    return new ComponentWithProperties(component, {
                        group: props.group,
                        period: props.period,
                        organization: organization.value,
                        iswNew: false,
                        saveHandler: async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                            patch.id = props.period.id;
                            await organizationManager.value.patchPeriod(patch);
                        },
                    });
                }
                catch (e) {
                    Toast.fromError(e).show();
                    throw e;
                }
            },
        }),
    });

    await present({
        animated,
        adjustHistory: animated,
        modalDisplayStyle: 'popup',
        components: [
            displayedComponent,
        ],
    });
}

async function editGeneral(animated = true) {
    const displayedComponent = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(PromiseView, {
            promise: async () => {
                try {
                    // Make sure we have an up to date group
                    await organizationManager.value.forceUpdate();
                    return new ComponentWithProperties(EditGroupView, {
                        group: props.group,
                        isNew: false,
                        saveHandler: async (patch: AutoEncoderPatchType<Group>) => {
                            const periodPatch = OrganizationRegistrationPeriod.patch({
                                id: props.period.id,
                            });
                            periodPatch.groups.addPatch(patch);
                            await organizationManager.value.patchPeriod(periodPatch);
                        },
                    });
                }
                catch (e) {
                    Toast.fromError(e).show();
                    throw e;
                }
            },
        }),
    });

    await present({
        animated,
        adjustHistory: animated,
        modalDisplayStyle: 'popup',
        components: [
            displayedComponent,
        ],
    });
}

async function editPermissions(animated = true) {
    await present({
        animated,
        adjustHistory: animated,
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditResourceRolesView, {
                description: 'Kies hier wie deze inschrijvingsgroep kan bekijken, bewerken of beheren.',
                resource: {
                    id: props.group.id,
                    name: props.group.settings.name,
                    type: PermissionsResourceType.Groups,
                },
                configurableAccessRights: [],
            }),
        ],
    });
}

async function editPage(animated = true) {
    await displayEditComponent(EditGroupPageView, animated);
}

async function editEmails(animated = true) {
    await present({
        components: [
            new ComponentWithProperties(EditEmailTemplatesView, {
                groups: props.group.waitingList ? [props.group, props.group.waitingList] : [props.group],
                allowEditGenerated: false,
                types: [
                    EmailTemplateType.RegistrationConfirmation,
                ],
            }),
        ],
        modalDisplayStyle: 'popup',
        animated,
    });
}

async function openGroup() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je de inschrijvingen wilt openen?', 'Ja, openen')) {
        return;
    }

    try {
        const p = Group.patch({
            id: props.group.id,
            status: GroupStatus.Open,
        });

        if (props.group.settings.registrationStartDate && props.group.settings.registrationStartDate.getTime() > Date.now()) {
            p.settings = GroupSettings.patch({
                registrationStartDate: null,
            });
        }

        if (props.group.settings.registrationEndDate && props.group.settings.registrationEndDate.getTime() <= Date.now()) {
            p.settings = GroupSettings.patch({
                registrationEndDate: null,
            });
        }
        await organizationManager.value.patchGroup(props.period, p);
        new Toast('De inschrijvingen zijn terug open', 'success green').show();
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}

async function archiveGroup() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je deze groep wilt archiveren?', 'Ja, archiveren')) {
        return;
    }

    try {
        const settingsPatch = OrganizationRegistrationPeriodSettings.patch({});

        for (const category of props.period.settings.categories) {
            if (category.groupIds.includes(props.group.id)) {
                const catPatch = GroupCategory.patch({ id: category.id });
                catPatch.groupIds.addDelete(props.group.id);
                settingsPatch.categories.addPatch(catPatch);
            }
        }

        const patch = OrganizationRegistrationPeriod.patch({
            id: props.period.id,
            settings: settingsPatch,
        });
        patch.groups.addPatch(Group.patch({
            id: props.group.id,
            status: GroupStatus.Archived,
        }));

        await organizationManager.value.patchPeriod(patch);
        new Toast('De groep is gearchiveerd', 'success green').show();
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}

async function deleteGroup() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je deze groep wilt verwijderen?', 'Ja, verwijderen')) {
        return;
    }

    if (!await CenteredMessage.confirm('Je kan dit niet ongedaan maken en verliest gegevens van alle bijhorende leden?', 'Ja, verwijderen')) {
        return;
    }

    try {
        const settingsPatch = OrganizationRegistrationPeriodSettings.patch({});

        for (const category of props.period.settings.categories) {
            if (category.groupIds.includes(props.group.id)) {
                const catPatch = GroupCategory.patch({ id: category.id });
                catPatch.groupIds.addDelete(props.group.id);
                settingsPatch.categories.addPatch(catPatch);
            }
        }

        const patch = OrganizationRegistrationPeriod.patch({
            id: props.period.id,
            settings: settingsPatch,
        });
        patch.groups.addDelete(props.group.id);

        await organizationManager.value.patchPeriod(patch);
        new Toast('De groep is verwijderd', 'success green').show();
        await navigationController.value?.pop({ force: true });
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}

const allCategories = computed(() => organization.value ? organization.value.getCategoryTree({ admin: true, permissions: auth.permissions }).getAllCategories().filter(c => c.categories.length === 0) : []);

async function restoreGroup(event: MouseEvent) {
    if (allCategories.value.length === 1) {
        await unarchiveGroupTo(props.group, allCategories.value[0]);
        return;
    }

    const menu = new ContextMenu([
        allCategories.value.map(cat =>
            new ContextMenuItem({
                name: cat.settings.name,
                rightText: cat.groupIds.length + '',
                action: () => {
                    unarchiveGroupTo(props.group, cat).catch(console.error);
                    return true;
                },
            }),
        ),
    ]);
    await menu.show({ clickEvent: event });
}

async function unarchiveGroupTo(group: Group, cat: GroupCategoryTree) {
    if (!await CenteredMessage.confirm(`${group.settings.name} terugzetten naar ${cat.settings.name}?`, 'Ja, terugzetten')) {
        return;
    }

    const wasArchive = isArchive.value;

    try {
        const settingsPatch = OrganizationRegistrationPeriodSettings.patch({});
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

        settingsPatch.categories.addPatch(catPatch);

        const patch = OrganizationRegistrationPeriod.patch({
            id: props.period.id,
            settings: settingsPatch,
        });

        patch.groups.addPatch(Group.patch({
            id: group.id,
            status: GroupStatus.Closed,
        }));

        try {
            await organizationManager.value.patchPeriod(patch);

            // Manually update this group
            const foundGroup = props.period.groups.find(g => g.id === group.id);
            if (foundGroup) {
                // Bit ugly, but only reliable way
                props.group.set(foundGroup);
            }
        }
        catch (e) {
            Toast.fromError(e).show();
        }
        new Toast(wasArchive ? 'De inschrijvingsgroep is teruggezet' : 'De inschrijvingen zijn gesloten', 'success green').show();
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}

async function closeGroup() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je de inschrijvingen wilt sluiten?', 'Ja, sluiten')) {
        return;
    }

    try {
        const patch = OrganizationRegistrationPeriod.patch({
            id: props.period.id,
        });
        patch.groups.addPatch(Group.patch({
            id: props.group.id,
            status: GroupStatus.Closed,
        }));

        await organizationManager.value.patchPeriod(patch);
        new Toast('De inschrijvingen zijn gesloten', 'success green').show();
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}
</script>
