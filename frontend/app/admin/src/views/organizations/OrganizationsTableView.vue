<template>
    <ModernTableView
        ref="modernTableView"
        :table-object-fetcher="tableObjectFetcher"
        :filter-builders="filterBuilders"
        :title="title"
        :column-configuration-id="configurationId"
        :actions="actions"
        :all-columns="allColumns"
        :prefix-column="allColumns[0]"
        :estimated-rows="estimatedRows"
        :route
    >
        <template #empty>
            {{ $t('%39') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import type { ComponentExposed } from '@stamhoofd/components/VueGlobalHelper.ts';

import type { RecipientMultipleChoiceOption } from '@stamhoofd/components/email/EmailView.vue';
import { useOrganizationsObjectFetcher } from '@stamhoofd/components/fetchers/useOrganizationsObjectFetcher.ts';
import { useGetOrganizationUIFilterBuilders } from '@stamhoofd/components/filters/filter-builders/organizations.ts';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useGlobalEventListener } from '@stamhoofd/components/hooks/useGlobalEventListener.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import ModernTableView from '@stamhoofd/components/tables/ModernTableView.vue';
import { Column } from '@stamhoofd/components/tables/classes/Column.ts';
import type { TableAction, TableActionSelection } from '@stamhoofd/components/tables/classes/TableAction.ts';
import { AsyncTableAction, InMemoryTableAction, MenuTableAction } from '@stamhoofd/components/tables/classes/TableAction.ts';
import { useTableObjectFetcher } from '@stamhoofd/components/tables/classes/TableObjectFetcher.ts';

import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { OrganizationTag, StamhoofdFilter } from '@stamhoofd/structures';
import { Address, EmailRecipientFilterType, EmailRecipientSubfilter, ExcelExportType, isEmptyFilter, Organization, OrganizationMetaData, OrganizationPrivateMetaData, TagHelper } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed, ref } from 'vue';

import { useChargeOrganizationsPopup } from './composables/useChargeOrganizationsPopup';
import { getSelectableWorkbook } from './getSelectableWorkbook';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage';
import { usePlatformManager } from '@stamhoofd/networking/PlatformManager';

type ObjectType = Organization;

const owner = useRequestOwner();
const platformManager = usePlatformManager();

const props = withDefaults(
    defineProps<{
        tag?: OrganizationTag | null;
    }>(),
    {
        tag: null,
    },
);

const title = computed(() => {
    if (props.tag) {
        if (props.tag.id !== '') {
            return props.tag.name;
        }
    }
    return $t('%53');
});

const estimatedRows = computed(() => {
    if (props.tag) {
        return props.tag.organizationCount;
    }
    return 30;
});

const context = useContext();
const present = usePresent();
const platform = usePlatform();
const auth = useAuth();
const { getOrganizationUIFilterBuilders } = useGetOrganizationUIFilterBuilders();
const chargeOrganizationsSheet = useChargeOrganizationsPopup();

const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>;
const configurationId = computed(() => {
    return 'organizations';
});
const filterBuilders = computed(() => getOrganizationUIFilterBuilders());

function getRequiredFilter(): StamhoofdFilter | null {
    if (props.tag) {
        if (props.tag.id === '') {
            return null;
        }

        if (props.tag.childTags.length > 0) {
            return {
                tags: {
                    $in: [...props.tag.childTags, props.tag.id],
                },
            };
        }

        return {
            tags: {
                $eq: props.tag.id,
            },
        };
    }

    return null;
}

useGlobalEventListener('organizations-deleted', async () => {
    tableObjectFetcher.reset(true, true);
});

const objectFetcher = useOrganizationsObjectFetcher({
    requiredFilter: getRequiredFilter(),
});

const tableObjectFetcher = useTableObjectFetcher<Organization>(objectFetcher);

const allColumns: Column<ObjectType, any>[] = [
    new Column<ObjectType, Organization>({
        id: 'uriPadded',
        name: '#',
        getValue: organization => organization,
        format: organization => organization.uri,
        getStyle: organization => organization.active ? 'info' : 'error',
        minimumWidth: 60,
        recommendedWidth: 100,
        index: 0,
    }),

    new Column<ObjectType, string>({
        id: 'name',
        name: $t(`%1Os`),
        getValue: organization => organization.name,
        minimumWidth: 100,
        recommendedWidth: 200,
        grow: true,
    }),

    new Column<ObjectType, boolean>({
        id: 'status',
        name: $t(`%1A`),
        getValue: organization => organization.active,
        format: active => active ? $t(`%1H0`) : $t(`%7G`),
        getStyle: active => active ? 'success' : 'error',
        minimumWidth: 100,
        recommendedWidth: 200,
        grow: true,
        allowSorting: false,
        enabled: false,
    }),

    new Column<ObjectType, string>({
        id: 'city',
        name: $t(`%1PP`),
        getValue: organization => organization.address.city,
        minimumWidth: 100,
        recommendedWidth: 200,
    }),
    new Column<ObjectType, string[]>({
        id: 'tags',
        name: $t(`%13`),
        allowSorting: false,
        getValue: organization => organization.meta.tags.map(t => platform.value.config.tags.find(tt => tt.id === t)?.name ?? $t(`%Gr`)),
        format: tags => tags.length === 0 ? $t(`%1FW`) : tags.join(', '),
        getStyle: tags => tags.length === 0 ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 300,
    }),
    new Column<ObjectType, { completed: number; total: number }>({
        id: 'setupSteps',
        name: $t(`%Gs`),
        allowSorting: false,
        getValue: organization => organization.period.setupSteps.getProgress(),
        format: (progress) => {
            const { completed, total } = progress;
            if (total === 0) {
                return $t(`%1FW`);
            }
            if (completed >= total) {
                return $t(`%Gt`);
            }
            return `${progress.completed}/${progress.total}`;
        },
        getStyle: (progress) => {
            const { completed, total } = progress;
            if (total === 0) {
                return 'gray';
            }
            if (completed >= total) {
                return 'success';
            }
            return 'gray';
        },
        minimumWidth: 50,
        recommendedWidth: 100,

    }),
];

const route = {
    component: async () => (await import('./OrganizationView.vue')).default,
    objectKey: 'organization',
};

function buildTagMenuActions(tags: OrganizationTag[], allTags: OrganizationTag[], groupIndex = 0, tagAction: (organizations: Organization[], tag: OrganizationTag, allTags: OrganizationTag[]) => Promise<void>): TableAction<Organization>[] {
    return tags.map((tag) => {
        const children = tag.childTags.flatMap((id) => {
            const t = allTags.find(t => t.id === id);
            return t ? [t] : [];
        });

        if (children.length > 0) {
            return new MenuTableAction({
                name: tag.name,
                groupIndex,
                allowAutoSelectAll: true,
                needsSelection: true,
                childActions: [
                    new InMemoryTableAction({
                        name: tag.name,
                        groupIndex: 0,
                        allowAutoSelectAll: true,
                        needsSelection: true,
                        handler: async (orgs: Organization[]) => tagAction(orgs, tag, allTags),
                    }),
                    ...buildTagMenuActions(children, allTags, 1, tagAction),
                ],
            });
        }

        return new InMemoryTableAction({
            name: tag.name,
            groupIndex,
            allowAutoSelectAll: true,
            needsSelection: true,
            handler: async (orgs: Organization[]) => tagAction(orgs, tag, allTags),
        });
    });
}

async function applyTagsPatchToOrganizations(organizations: Organization[], tagsPatch: PatchableArray<string, string, string>) {
    for (const org of organizations) {
        const result = await context.value.getAuthenticatedServerForOrganization(org.id).request({
            method: 'PATCH',
            path: '/organization',
            body: Organization.patch({
                id: org.id,
                meta: OrganizationMetaData.patch({
                    tags: tagsPatch,
                }),
            }),
            shouldRetry: false,
            owner,
            decoder: Organization as Decoder<Organization>,
        });

        org.meta.deepSet(result.data.meta);
    }

    await platformManager.value.forceUpdate();
}

async function addTagToOrganizations(organizations: Organization[], tag: OrganizationTag, _allTags: OrganizationTag[]) {
    // backend will ensure all predecessor tags are also added

    const toUpdate = organizations.filter(org => !org.meta.tags.includes(tag.id)); // filter out organizations that already have the tag

    if (toUpdate.length === 0) {
        if (organizations.length === 1) {
            Toast.info($t('{orgName} heeft al de tag {tagName}', { orgName: organizations[0].name, tagName: tag.name })).show();
        } else {
            Toast.info($t('De {numOrganizations} geselecteerde #groepen hebben al de tag {tagName}', { numOrganizations: organizations.length, tagName: tag.name })).show();
        }
        return;
    }

    const noUpdate = organizations.filter(org => org.meta.tags.includes(tag.id));
    let message = '';
    if (toUpdate.length === 1) {
        message += $t('De tag {tagName} zal worden toegevoegd aan {orgName}.', { tagName: tag.name, orgName: toUpdate[0].name });
    } else {
        message += $t('De tag {tagName} zal worden toegevoegd aan {numToUpdate} #groepen.', { tagName: tag.name, numToUpdate: toUpdate.length });
    }
    if (noUpdate.length === 1) {
        message += ` ${$t('{orgName} heeft deze tag al.', { orgName: noUpdate[0].name })}`;
    } else if (noUpdate.length > 1) {
        message += ` ${$t('De overige {numNoUpdate} geselecteerde #groepen hebben deze tag al.', { numNoUpdate: noUpdate.length })}`;
    }

    const confirmed = await CenteredMessage.confirm(message, $t('Bevestigen'));
    if (!confirmed) {
        return;
    }

    const tagsPatch = new PatchableArray<string, string, string>();
    tagsPatch.addPut(tag.id);

    await applyTagsPatchToOrganizations(toUpdate, tagsPatch);

    // after add, no reset on table fetches is needed
}

async function removeTagFromOrganizations(organizations: Organization[], tag: OrganizationTag, allTags: OrganizationTag[]) {
    // frontend needs to remove all descendant tags as well, as the backend would otherwise re-add this tag
    const tagsToRemove = [tag.id, ...TagHelper.getAllDescendants(tag.id, { allTags })];

    const toUpdate = organizations.filter(org => org.meta.tags.some(t => tagsToRemove.includes(t))); // filter out organizations that don't have the tag
    if (toUpdate.length === 0) {
        if (organizations.length === 1) {
            Toast.info($t('{orgName} heeft de tag {tagName} niet', { orgName: organizations[0].name, tagName: tag.name })).show();
        } else {
            Toast.info($t('Geen van de {numOrganizations} geselecteerde #groepen heeft de tag {tagName}', { numOrganizations: organizations.length, tagName: tag.name })).show();
        }
        return;
    }

    const noUpdate = organizations.filter(org => !org.meta.tags.some(t => tagsToRemove.includes(t)));
    let message = '';
    if (toUpdate.length === 1) {
        message += $t('De tag {tagName} zal worden verwijderd van {orgName}.', { tagName: tag.name, orgName: toUpdate[0].name });
    } else {
        message += $t('De tag {tagName} zal worden verwijderd van {numToUpdate} #groepen.', { tagName: tag.name, numToUpdate: toUpdate.length });
    }
    if (noUpdate.length === 1) {
        message += ` ${$t('{orgName} heeft deze tag niet.', { orgName: noUpdate[0].name })}`;
    } else if (noUpdate.length > 1) {
        message += ` ${$t('De overige {numNoUpdate} geselecteerde #groepen hebben deze tag niet.', { numNoUpdate: noUpdate.length })}`;
    }

    const confirmed = await CenteredMessage.confirm(message, $t('Bevestigen'));
    if (!confirmed) {
        return;
    }

    const tagsPatch = new PatchableArray<string, string, string>();
    for (const t of tagsToRemove) {
        tagsPatch.addDelete(t);
    }

    await applyTagsPatchToOrganizations(toUpdate, tagsPatch);

    if (props.tag && tagsToRemove.includes(props.tag.id)) {
        tableObjectFetcher.reset(true, true);
    }
}

const actions: TableAction<Organization>[] = [];

actions.push(
    new MenuTableAction({
        name: $t('Tag toevoegen'),
        icon: 'label',
        priority: 2,
        groupIndex: 4,
        allowAutoSelectAll: true,
        needsSelection: true,
        enabled: () => platform.value.config.tags.length > 0,
        childActions: () => {
            const allTags = platform.value.config.tags;
            const rootTags = TagHelper.getRootTags(allTags);
            return buildTagMenuActions(rootTags, allTags, 0, addTagToOrganizations);
        },
    }),
);
actions.push(
    new MenuTableAction({
        name: $t('Tag verwijderen'),
        icon: 'label_off',
        priority: 1,
        groupIndex: 4,
        allowAutoSelectAll: true,
        needsSelection: true,
        enabled: () => platform.value.config.tags.length > 0,
        childActions: () => {
            const allTags = platform.value.config.tags;
            const rootTags = TagHelper.getRootTags(allTags);
            return buildTagMenuActions(rootTags, allTags, 0, removeTagFromOrganizations);
        },
    }),
);

async function openMail(selection: TableActionSelection<Organization>) {
    const filter = selection.filter.filter;
    const search = selection.filter.search;

    const option: RecipientMultipleChoiceOption = {
        type: 'MultipleChoice',
        options: [],
        build: (selectedIds: string[]) => {
            const q = EmailRecipientSubfilter.create({
                type: EmailRecipientFilterType.Members,
                filter: {
                    responsibilities: {
                        $elemMatch: {
                            responsibilityId: {
                                $in: selectedIds,
                            },
                            endDate: null,
                            ...(isEmptyFilter(filter) ? {} : { organization: filter }),
                        },
                    },
                },
                search,
            });

            return [
                q,
            ];
        },
    };

    for (const responsibility of platform.value.config.responsibilities) {
        if (!responsibility.organizationBased) {
            continue;
        }
        option.options.push(
            {
                id: responsibility.id,
                name: responsibility.name,
            },
        );
    }

    const displayedComponent = new ComponentWithProperties(NavigationController, {
        root: AsyncComponent(() => import('@stamhoofd/components/email/EmailView.vue'), {
            recipientFilterOptions: [option],
        }),
    });
    await present({
        components: [
            displayedComponent,
        ],
        modalDisplayStyle: 'popup',
    });
}

async function exportToExcel(selection: TableActionSelection<ObjectType>) {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('@stamhoofd/frontend-excel-export/ExcelExportView.vue'), {
                    type: ExcelExportType.Organizations,
                    filter: selection.filter,
                    workbook: getSelectableWorkbook(platform.value),
                    configurationId: configurationId.value,
                    title: getExcelTitle(selection),
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

function getExcelTitle(selection: TableActionSelection<ObjectType>) {
    if (selection.markedRows && selection.markedRowsAreSelected && selection.markedRows.size === 1) {
        return [...selection.markedRows.values()][0].name;
    }
    const parts = [
        props.tag?.id ? props.tag.name : null,
        $t('#Groepen'),
    ];

    return parts.filter(Boolean).join(' - ');
}

if (auth.hasPlatformFullAccess()) {
    actions.push(
        new InMemoryTableAction({
            name: $t('%3E'),
            icon: 'add',
            priority: 0,
            groupIndex: 1,
            needsSelection: false,
            handler: async () => {
                const organization = Organization.create({
                    address: Address.createDefault(I18nController.shared.countryCode),
                    privateMeta: OrganizationPrivateMetaData.create({}),
                });

                const component = AsyncComponent(() => import('./EditOrganizationView.vue'), {
                    isNew: true,
                    organization,
                    saveHandler: async (patch: AutoEncoderPatchType<Organization>) => {
                        const put = organization.patch(patch);

                        const arr: PatchableArrayAutoEncoder<Organization> = new PatchableArray();
                        arr.addPut(put);

                        await context.value.authenticatedServer.request({
                            method: 'PATCH',
                            path: '/admin/organizations',
                            body: arr,
                            shouldRetry: false,
                            owner,
                            decoder: new ArrayDecoder(Organization as Decoder<Organization>),
                        });
                        new Toast($t('%34'), 'success green').show();

                        // Reload table
                        tableObjectFetcher.reset(true, true);
                    },
                });

                await present({
                    modalDisplayStyle: 'popup',
                    components: [component],
                });
            },
        }),
    );

    actions.push(new AsyncTableAction({
        name: $t(`%Gb`),
        icon: 'email',
        priority: 12,
        groupIndex: 3,
        handler: async (selection: TableActionSelection<Organization>) => {
            await openMail(selection);
        },
    }));

    actions.push(new AsyncTableAction({
        name: $t(`%Gu`),
        icon: 'calculator',
        priority: 13,
        groupIndex: 4,
        handler: async (selection: TableActionSelection<Organization>) => {
            await chargeOrganizationsSheet.present(selection.filter.filter);
        },
    }));

    actions.push(
        new AsyncTableAction({
            name: $t(`%Gc`),
            icon: 'download',
            priority: 11,
            groupIndex: 3,
            handler: async (selection) => {
                await exportToExcel(selection);
            },
        }),
    );
}
</script>
