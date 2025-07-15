<template>
    <ExternalOrganizationContainer v-slot="{externalOrganization: groupOrganization}" :organization-id="group.organizationId" @update="setOrganization">
        <SaveView :save-text="$t('c72a9ab2-98a0-4176-ba9b-86fe009fa755')" :loading="saving" :title="$t(`01e2b860-7045-4a0c-84ca-2303346d14b2`)" @save="goNext">
            <p v-if="!checkout.isAdminFromSameOrganization" class="style-title-prefix">
                {{ groupOrganization!.name }}
            </p>
            <h1>{{ $t('cec2dffb-f38d-4337-b575-8cf37d6556a2', {group: group.settings.name}) }}</h1>

            <div class="input-with-buttons">
                <div>
                    <form class="input-icon-container icon search gray" @submit.prevent="blurFocus">
                        <input v-model="searchQuery" class="input" name="search" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t(`01e2b860-7045-4a0c-84ca-2303346d14b2`)">
                    </form>
                </div>
                <div>
                    <button type="button" class="button text" @click="editFilter">
                        <span class="icon filter" />
                        <span class="hide-small">{{ $t('de5706ec-7edc-4e62-b3f7-d6e414720480') }}</span>
                        <span v-if="!isEmptyFilter(fetcher.baseFilter)" class="icon dot primary" />
                    </button>
                </div>
            </div>

            <p v-if="fetcher.objects.length > 1 && canSelectAll || canUnselectAll" class="style-description-small for-input">
                {{ $t('e0581b7e-aaa2-4e8e-85fc-6a1b9ed4900a') }}  <button v-if="canSelectAll" class="inline-link" type="button" @click="selectAllResults">
                    {{ $t('62d13348-4438-44e4-9ea0-c4fb42c0123b') }}
                </button>

                <button v-else-if="canUnselectAll" class="inline-link" type="button" @click="deselectAllResults">
                    {{ $t('e1efdf4c-de0b-4c12-ba87-dec739b2186f') }}
                </button>
            </p>

            <STList v-if="fetcher.objects.length">
                <RegisterItemCheckboxRow v-for="member in fetcher.objects" :key="member.id" :member="member" :group="group" :group-organization="groupOrganization" />
            </STList>
            <InfiniteObjectFetcherEnd :empty-message="$t('c047e46b-8588-4285-9443-76c0da534b53')" :fetcher="fetcher" />
        </SaveView>
    </ExternalOrganizationContainer>
</template>

<script setup lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { ErrorBox, ExternalOrganizationContainer, InfiniteObjectFetcherEnd, Toast, UIFilter, UIFilterEditor, useErrors, useInfiniteObjectFetcher, usePositionableSheet } from '@stamhoofd/components';
import { assertSort, Group, isEmptyFilter, LimitedFilteredRequest, MembersBlob, Organization, PaginatedResponseDecoder, PlatformFamily, PlatformMember, RegisterCheckout, RegisterItem, SortItemDirection, SortList } from '@stamhoofd/structures';
import { computed, Ref, ref, watchEffect } from 'vue';
import { useAdvancedMemberWithRegistrationsBlobUIFilterBuilders } from '../filters/filter-builders/members';
import { useAuth, useContext, useOrganization, usePlatform } from '../hooks';
import { NavigationActions, useNavigationActions } from '../types/NavigationActions';
import RegisterItemCheckboxRow from './components/group/RegisterItemCheckboxRow.vue';

type ObjectType = PlatformMember;

const props = defineProps<{
    members: PlatformMember[];
    group: Group;
    checkout: RegisterCheckout; // we should auto assign this checkout to all search results and newly created members
    saveHandler: (navigate: NavigationActions) => void | Promise<void>;
}>();

function setOrganization(groupOrganization: Organization) {
    props.checkout.setDefaultOrganization(groupOrganization);
}

const searchQuery = ref('');

const context = useContext();
const contextOrganization = useOrganization();
const platform = usePlatform();
const { presentPositionableSheet } = usePositionableSheet();
const navigate = useNavigationActions();
const errors = useErrors();
const saving = ref(false);
const auth = useAuth();

const { filterBuilders, loading } = useAdvancedMemberWithRegistrationsBlobUIFilterBuilders();
const selectedUIFilter = ref(filterBuilders.value[0].fromFilter(props.group.getRecommendedFilter(auth.hasSomePlatformAccess() ? (contextOrganization.value?.id ?? null) : null))) as Ref<null | UIFilter>;

async function editFilter(event: MouseEvent) {
    if (!filterBuilders) {
        return;
    }
    const filter = selectedUIFilter.value ?? filterBuilders.value[0].create();
    if (!selectedUIFilter.value) {
        selectedUIFilter.value = filter;
    }

    await presentPositionableSheet(event, {
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(UIFilterEditor, {
                    filter,
                }),
            }),
        ],
    });
}

function extendSort(list: SortList): SortList {
    return assertSort(list, [
        { key: 'birthDay', order: SortItemDirection.ASC },
        { key: 'id' },
    ]);
}

const fetcher = useInfiniteObjectFetcher<ObjectType>({
    get requiredFilter() {
        if (!contextOrganization.value) {
            throw new Error('Organization is required');
        }

        // we already add this by default in the backend
        return null;
        // return {
        //    registrations: {
        //        $elemMatch: {
        //            organization: {
        //                id: contextOrganization.value.id
        //            },
        //        }
        //    }
        // };
    },
    async fetch(data: LimitedFilteredRequest): Promise<{ results: ObjectType[]; next?: LimitedFilteredRequest }> {
        console.log('Members.fetch', data);
        data.sort = extendSort(data.sort);

        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/members',
            decoder: new PaginatedResponseDecoder(MembersBlob as Decoder<MembersBlob>, LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
            query: data,
            shouldRetry: false,
            owner: this,
        });

        console.log('[Done] Members.fetch', data, response.data);

        const blob = response.data.results;

        const results = PlatformFamily.createSingles(blob, {
            contextOrganization: context.value.organization,
            platform: platform.value,
        });

        for (const result of results) {
            result.family.checkout = props.checkout;
        }

        return {
            results,
            next: response.data.next,
        };
    },

    async fetchCount(): Promise<number> {
        throw new Error('Method not implemented.');
    },
});

watchEffect(() => {
    fetcher.setSearchQuery(searchQuery.value);
    const filter = selectedUIFilter.value ? selectedUIFilter.value.build() : null;
    fetcher.setFilter(filter);
});

function blurFocus() {
    (document.activeElement as HTMLElement)?.blur();
}

const canSelectAll = computed(() => {
    if (!props.checkout.isAdminFromSameOrganization) {
        return false;
    }
    if (fetcher.hasMoreObjects || !props.checkout.singleOrganization || fetcher.objects.length === 0) {
        return false;
    }

    if (props.group.settings.recordCategories.length > 0) {
        return false;
    }

    for (const member of fetcher.objects) {
        if (!props.checkout.cart.containsMemberAndGroup(member.id, props.group.id)) {
            if (member.canRegister(props.group, props.checkout.singleOrganization)) {
                return true;
            }
        }
    }

    return false;
});

const canUnselectAll = computed(() => {
    if (fetcher.hasMoreObjects || !props.checkout.singleOrganization || fetcher.objects.length === 0) {
        return false;
    }

    for (const member of fetcher.objects) {
        if (!props.checkout.cart.containsMemberAndGroup(member.id, props.group.id)) {
            if (member.canRegister(props.group, props.checkout.singleOrganization)) {
                return false;
            }
        }
    }
    return true;
});

function deselectAllResults() {
    for (const member of fetcher.objects) {
        props.checkout.cart.removeMemberAndGroup(member.id, props.group.id);
    }
}

function selectAllResults() {
    if (fetcher.hasMoreObjects || !props.checkout.singleOrganization) {
        Toast.error($t(`b9b8f956-8c87-413b-a94d-2f31941e3da1`)).show();
        return;
    }

    for (const member of fetcher.objects) {
        try {
            const item = RegisterItem.defaultFor(member, props.group, props.checkout.singleOrganization);
            if (item.validationError) {
                if (!item.validationErrorForWaitingList && props.group.waitingList) {
                    const item2 = RegisterItem.defaultFor(member, props.group.waitingList, props.checkout.singleOrganization);
                    if (!item2.validationError) {
                        props.checkout.add(item2);
                    }
                }

                continue;
            }
            props.checkout.add(item);
        }
        catch (e) {
            // prob invalid
            return;
        }
    }
}

async function goNext() {
    if (saving.value) {
        return;
    }

    saving.value = true;
    try {
        await props.saveHandler(navigate);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    finally {
        saving.value = false;
    }
}

</script>
