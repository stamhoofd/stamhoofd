<template>
    <div id="webshop-overview" class="st-view background">
        <STNavigationBar :title="title" />

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
                {{ $t('86b4a41f-1353-44c9-a2dc-7d6f5ccc371a') }}
            </p>
            <p v-if="!isArchive && !isOpen" class="info-box">
                {{ $t('fb583c62-4ebf-4a54-acbf-5be7c07e09dd') }} <template v-if="hasFullPermissions">
                    {{ $t('600685cc-2cb6-4a99-a0e0-2ca271b89fcb') }}
                </template>
            </p>

            <BillingWarningBox filter-types="members" class="data-table-prefix" />

            <STList class="illustration-list">
                <STListItem :selectable="true" class="left-center right-stack" @click="navigate(Routes.Members)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/group.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('ba230e6d-38eb-4bf4-9735-4249c96a95e9') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('8063280c-a4d1-4acf-a54d-dff02e973909') }}
                    </p>
                    <template #right>
                        <span v-if="group.getMemberCount() !== null" class="style-description-small">{{ formatInteger(group.getMemberCount()!) }}</span>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="group.waitingList && auth.canAccessGroup(group.waitingList, PermissionLevel.Read)" :selectable="true" class="left-center right-stack" @click="navigate(Routes.WaitingList)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/clock.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('a56bcf08-214d-421b-9cc0-336d2b5ab0ea') }}
                        <span v-if="group.waitingList.closed && !group.closed" class="style-tag error">{{ $t('f6c28298-1b38-4794-988e-f8c8eb496acf') }}</span>
                        <span v-if="!group.waitingList.closed && group.closed" class="style-tag success">{{ $t('22703e89-376e-453d-9fc6-c449193be678') }}</span>
                    </h2>
                    <p class="style-description">
                        {{ $t('94832a03-67fb-4b99-ae40-d41d5601d690') }}
                    </p>
                    <template #right>
                        <span v-if="group.waitingList.getMemberCount() !== null" class="style-description-small">{{ formatInteger(group.waitingList.getMemberCount()!) }}</span>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-for="responsibility of linkedResponsibilities" :key="responsibility.id" :selectable="true" class="left-center right-stack" @click="openResponsibility(responsibility)">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/responsibility.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ responsibility.name }} van {{ group.settings.name }}
                    </h2>
                    <p class="style-description">
                        {{ $t('500b29a8-32bd-484a-9bbd-650473f6b38a') }}
                    </p>

                    <template #right>
                        <MemberCountSpan :filter="getResponsibilityFilter(responsibility)" class="style-description-small" />
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <template v-if="hasFullPermissions">
                <hr><h2>{{ $t('bab38c80-8ab6-4cb7-80c3-1f607057e45d') }}</h2>

                <STList class="illustration-list">
                    <STListItem :selectable="true" class="left-center" @click="editGeneral(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/flag.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('35757756-d817-419d-82dd-1ba14128af30') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('01e49485-5aa4-4667-883d-a1083dfbe3a3') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editPermissions(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/lock.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('70c5edd2-3550-447e-8a36-b43d7833fe1c') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('426b8e47-ea7c-4658-a13a-eed7ac0eafc1') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editPage(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/palette.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t("f1d59047-109f-45f2-8f54-a412b564d4e7") }}
                        </h2>
                        <p class="style-description">
                            {{ $t('1988fd3c-c2b2-4894-8993-c15c698cba9e') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" class="left-center" @click="editEmails(true)">
                        <template #left>
                            <img src="@stamhoofd/assets/images/illustrations/email-template.svg">
                        </template>
                        <h2 class="style-title-list">
                            {{ $t('f0b50a39-d4fd-4f97-802d-a599b00030fd') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('dd3b8b5f-0f31-4b70-99fa-cc4ed29e70aa') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>

                <hr><h2>{{ $t('dc052084-eea5-407e-8775-237bf550895a') }}</h2>

                <STList>
                    <STListItem v-if="!isArchive && !isOpen" :selectable="true" @click="openGroup()">
                        <h2 class="style-title-list">
                            {{ $t('37e053fe-6652-49d0-80a6-9ac4995cfa8a') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('0a7c256d-1502-4865-97fe-91390b8f3c21') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary green hide-smartphone">
                                <span class="icon power" />
                                <span>{{ $t('cd0a1bf5-5cfe-40c6-bbd1-9f40574d559b') }}</span>
                            </button>
                            <button type="button" class="button icon power only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem v-if="!isArchive && isOpen" :selectable="true" @click="closeGroup()">
                        <h2 class="style-title-list">
                            {{ $t('01f61997-3e70-41fa-85bd-9d0311caddcd') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('db492b1b-51de-48f1-b620-8bdc6dc5c3db') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary danger hide-smartphone">
                                <span class="icon power" />
                                <span>{{ $t('bef7a2f9-129a-4e1c-b8d2-9003ff0a1f8b') }}</span>
                            </button>
                            <button type="button" class="button icon power only-smartphone" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" @click="deleteGroup()">
                        <h2 class="style-title-list">
                            {{ $t('ef4584d3-5c76-4ed4-9f4f-4451b7cd3e14') }}
                        </h2>
                        <p class="style-description">
                            {{ $t('34a9760e-21d2-47c7-8311-06d34c8a8561') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary danger hide-smartphone">
                                <span class="icon trash" />
                                <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
                            </button>
                            <button type="button" class="button icon trash only-smartphone" />
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
import { CenteredMessage, ContextMenu, ContextMenuItem, EditEmailTemplatesView, EditGroupView, EditResourceRolesView, MemberCountSpan, MembersTableView, PromiseView, RegistrationsTableView, STList, STListItem, STNavigationBar, Toast, useAuth, useOrganization, usePlatform } from '@stamhoofd/components';
import { useOrganizationManager, usePatchOrganizationPeriod } from '@stamhoofd/networking';
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
const title = computed(() => props.group.settings.name.toString());
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
const patchOrganizationPeriod = usePatchOrganizationPeriod();

enum Routes {
    Registrations = 'inschrijvingen',
    Members = 'Members',
    WaitingList = 'WaitingList',
    Responsibility = 'Responsibility',
}

defineRoutes([{
    url: 'inschrijvingen',
    name: Routes.Members,
    component: RegistrationsTableView as ComponentOptions,
    paramsToProps: () => {
        return {
            group: props.group,
            organization: organization.value,
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
                            await patchOrganizationPeriod(patch);
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
                        period: props.period,
                        groupId: props.group.id,
                        isNew: false,
                        saveHandler: async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                            await patchOrganizationPeriod(patch);
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
                description: $t('e83fded1-6903-4459-9ef0-4fe9d7238bab'),
                resource: {
                    id: props.group.id,
                    name: props.group.settings.name.toString(),
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
        const patch = OrganizationRegistrationPeriod.patch({
            id: props.period.id,
        });
        patch.groups.addPatch(p);
        await patchOrganizationPeriod(patch);
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

        await patchOrganizationPeriod(patch);
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

        await patchOrganizationPeriod(patch);
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
            await patchOrganizationPeriod(patch);

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

        await patchOrganizationPeriod(patch);
        new Toast('De inschrijvingen zijn gesloten', 'success green').show();
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}
</script>
