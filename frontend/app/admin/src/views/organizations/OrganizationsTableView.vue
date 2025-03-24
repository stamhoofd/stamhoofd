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
        :Route="Route"
    >
        <template #empty>
            {{ $t('4fa242b7-c05d-44d4-ada5-fb60e91af818') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncTableAction, Column, ComponentExposed, EmailView, InMemoryTableAction, ModernTableView, RecipientMultipleChoiceOption, TableAction, TableActionSelection, Toast, useAuth, useContext, useGetOrganizationUIFilterBuilders, useGlobalEventListener, useOrganizationsObjectFetcher, usePlatform, useTableObjectFetcher } from '@stamhoofd/components';
import { ExcelExportView } from '@stamhoofd/frontend-excel-export';
import { I18nController, useTranslate } from '@stamhoofd/frontend-i18n';
import { useRequestOwner } from '@stamhoofd/networking';
import { Address, EmailRecipientFilterType, EmailRecipientSubfilter, ExcelExportType, isEmptyFilter, Organization, OrganizationPrivateMetaData, OrganizationTag, StamhoofdFilter } from '@stamhoofd/structures';
import { computed, Ref, ref } from 'vue';
import EditOrganizationView from './EditOrganizationView.vue';
import OrganizationView from './OrganizationView.vue';
import { useChargeOrganizationsPopup } from './composables/useChargeOrganizationsPopup';
import { getSelectableWorkbook } from './getSelectableWorkbook';

type ObjectType = Organization;
const $t = useTranslate();
const owner = useRequestOwner();

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
    return $t('d4a9ca3f-72c9-4418-90fa-5d648b23ee7e');
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
const filterBuilders = computed(() => getOrganizationUIFilterBuilders(auth.user));

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
        name: 'Naam',
        getValue: organization => organization.name,
        minimumWidth: 100,
        recommendedWidth: 200,
        grow: true,
    }),

    new Column<ObjectType, boolean>({
        id: 'status',
        name: 'Status',
        getValue: organization => organization.active,
        format: active => active ? 'Actief' : 'Inactief',
        getStyle: active => active ? 'success' : 'error',
        minimumWidth: 100,
        recommendedWidth: 200,
        grow: true,
        allowSorting: false,
        enabled: false,
    }),

    new Column<ObjectType, string>({
        id: 'city',
        name: 'Gemeente',
        getValue: organization => organization.address.city,
        minimumWidth: 100,
        recommendedWidth: 200,
    }),
    new Column<ObjectType, string[]>({
        id: 'tags',
        name: 'Tags',
        allowSorting: false,
        getValue: organization => organization.meta.tags.map(t => platform.value.config.tags.find(tt => tt.id === t)?.name ?? 'Onbekend'),
        format: tags => tags.length === 0 ? 'Geen' : tags.join(', '),
        getStyle: tags => tags.length === 0 ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 300,
    }),
    new Column<ObjectType, { completed: number; total: number }>({
        id: 'setupSteps',
        name: 'Vlagmoment',
        allowSorting: false,
        getValue: organization => organization.period.setupSteps.getProgress(),
        format: (progress) => {
            const { completed, total } = progress;
            if (total === 0) {
                return 'Geen';
            }
            if (completed >= total) {
                return 'Voltooid';
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

const Route = {
    Component: OrganizationView,
    objectKey: 'organization',
};

const actions: TableAction<Organization>[] = [];

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
        root: new ComponentWithProperties(EmailView, {
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
                root: new ComponentWithProperties(ExcelExportView, {
                    type: ExcelExportType.Organizations,
                    filter: selection.filter,
                    workbook: getSelectableWorkbook(platform.value),
                    configurationId: configurationId.value,
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

if (auth.hasPlatformFullAccess()) {
    actions.push(
        new InMemoryTableAction({
            name: $t('7066aee7-9e51-4767-b288-460646ceca50'),
            icon: 'add',
            priority: 0,
            groupIndex: 1,
            needsSelection: false,
            enabled: true,
            handler: async () => {
                const organization = Organization.create({
                    address: Address.createDefault(I18nController.shared.countryCode),
                    privateMeta: OrganizationPrivateMetaData.create({}),
                });

                const component = new ComponentWithProperties(EditOrganizationView, {
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
                        new Toast($t('8459189d-6f9a-4541-9fb7-7618061f1969'), 'success green').show();

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
        name: 'E-mailen',
        icon: 'email',
        priority: 12,
        groupIndex: 3,
        handler: async (selection: TableActionSelection<Organization>) => {
            await openMail(selection);
        },
    }));

    actions.push(new AsyncTableAction({
        name: 'Bedrag aanrekenen',
        icon: 'calculator',
        priority: 13,
        groupIndex: 4,
        handler: async (selection: TableActionSelection<Organization>) => {
            await chargeOrganizationsSheet.present(selection.filter.filter);
        },
    }));

    actions.push(
        new AsyncTableAction({
            name: 'Exporteren naar Excel',
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
