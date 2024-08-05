<template>
    <ExternalOrganizationContainer v-slot="{externalOrganization: groupOrganization}" :organization-id="group.organizationId" @update="setOrganization">
        <SaveView save-text="Doorgaan" title="Zoeken" :loading="saving" @save="goNext">
            <p v-if="!checkout.isAdminFromSameOrganization" class="style-title-prefix">
                {{ groupOrganization!.name }}
            </p>
            <h1>Zoek bestaande leden voor {{ group.settings.name }}</h1>

            <div class="input-with-buttons">
                <div>
                    <form class="input-icon-container icon search gray" @submit.prevent="blurFocus">
                        <input v-model="searchQuery" class="input" name="search" placeholder="Zoeken" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off">
                    </form>
                </div>
                <div>
                    <button type="button" class="button text" @click="editFilter">
                        <span class="icon filter" />
                        <span class="hide-small">Filter</span>
                        <span v-if="!isEmptyFilter(fetcher.baseFilter)" class="icon dot primary" />
                    </button>
                </div>
            </div>

            <p v-if="fetcher.objects.length > 1 && canSelectAll || canUnselectAll" class="style-description-small for-input">
                Snel selecteren:  <button v-if="canSelectAll" class="inline-link" type="button" @click="selectAllResults">
                    Selecteer alles
                </button>

                <button v-else-if="canUnselectAll" class="inline-link" type="button" @click="deselectAllResults">
                    Deselecteer alles
                </button>
            </p>

            <STList v-if="fetcher.objects.length">
                <RegisterItemCheckboxRow
                    v-for="member in fetcher.objects" 
                    :key="member.id" 
                    :member="member" 
                    :group="group" 
                    :group-organization="groupOrganization" 
                />
            </STList>
            <InfiniteObjectFetcherEnd empty-message="Geen leden gevonden" :fetcher="fetcher" />
        </SaveView>
    </ExternalOrganizationContainer>
</template>

<script setup lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { ErrorBox, ExternalOrganizationContainer, getAdvancedMemberWithRegistrationsBlobUIFilterBuilders, InfiniteObjectFetcherEnd, Toast, UIFilter, UIFilterEditor, useErrors, useInfiniteObjectFetcher, usePositionableSheet } from '@stamhoofd/components';
import { assertSort, Group, isEmptyFilter, LimitedFilteredRequest, MembersBlob, Organization, PaginatedResponseDecoder, PlatformFamily, PlatformMember, RegisterCheckout, RegisterItem, SortItemDirection, SortList } from '@stamhoofd/structures';
import { computed, Ref, ref, watchEffect } from 'vue';
import { useAuth, useContext, useOrganization, usePlatform } from '../hooks';
import { NavigationActions, useNavigationActions } from '../types/NavigationActions';
import RegisterItemCheckboxRow from './components/group/RegisterItemCheckboxRow.vue';

type ObjectType = PlatformMember;

const props = defineProps<{
    members: PlatformMember[]
    group: Group
    checkout: RegisterCheckout, // we should auto assign this checkout to all search results and newly created members
    saveHandler: (navigate: NavigationActions) => void|Promise<void>
}>();

function setOrganization(groupOrganization: Organization) {
    props.checkout.setDefaultOrganization(groupOrganization)
}

const searchQuery = ref('');

const context = useContext();
const contextOrganization = useOrganization()
const platform = usePlatform();
const {presentPositionableSheet} = usePositionableSheet()
const navigate = useNavigationActions();
const errors = useErrors();
const saving = ref(false)

const auth = useAuth();

const filterBuilders = getAdvancedMemberWithRegistrationsBlobUIFilterBuilders(platform.value, {
    user: auth.user,
})
const selectedUIFilter = ref(filterBuilders[0].fromFilter(props.group.settings.getRecommendedFilter())) as Ref<null|UIFilter>;

async function editFilter(event: MouseEvent) {
    if (!filterBuilders) {
        return
    }
    const filter = selectedUIFilter.value ?? filterBuilders[0].create()
    if (!selectedUIFilter.value) {
        selectedUIFilter.value = filter;
    }

    await presentPositionableSheet(event, {
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(UIFilterEditor, {
                    filter
                })
            })
        ]
    })
}

function extendSort(list: SortList): SortList  {
    return assertSort(list, [
        {key: "birthDay", order: SortItemDirection.ASC},
        {key: "id"}
    ])
}

const fetcher = useInfiniteObjectFetcher<ObjectType>({
    get requiredFilter() {
        if (!contextOrganization.value) {
            throw new Error("Organization is required")
        }
        return {
            registrations: {
                $elemMatch: {
                    organization: {
                        id: contextOrganization.value.id
                    },
                }
            }
        };
    },
    async fetch(data: LimitedFilteredRequest): Promise<{results: ObjectType[], next?: LimitedFilteredRequest}> {
        console.log('Members.fetch', data);
        data.sort = extendSort(data.sort);

        const response = await context.value.authenticatedServer.request({
            method: "GET",
            path: "/members",
            decoder: new PaginatedResponseDecoder(MembersBlob as Decoder<MembersBlob>, LimitedFilteredRequest as Decoder<LimitedFilteredRequest>),
            query: data,
            shouldRetry: false,
            owner: this
        });

        console.log('[Done] Members.fetch', data, response.data);

        const blob = response.data.results;

        const results = PlatformFamily.createSingles(blob, {
            contextOrganization: context.value.organization,
            platform: platform.value
        })

        for (const result of results) {
            result.family.checkout = props.checkout
        }
        
        return {
            results,
            next: response.data.next
        }
    },

    async fetchCount(): Promise<number> {
        throw new Error("Method not implemented.");
    }
})

watchEffect(() => {
    fetcher.setSearchQuery(searchQuery.value)
    const filter = selectedUIFilter.value ? selectedUIFilter.value.build() : null;
    fetcher.setFilter(filter)
})

function blurFocus() {
    (document.activeElement as HTMLElement)?.blur()
}

const canSelectAll = computed(() => {
    if (fetcher.hasMoreObjects || !props.checkout.singleOrganization || fetcher.objects.length === 0) {
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
})

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
})

function deselectAllResults() {
    for (const member of fetcher.objects) {
        props.checkout.cart.removeMemberAndGroup(member.id, props.group.id)
    }
}

function selectAllResults() {
    if (fetcher.hasMoreObjects || !props.checkout.singleOrganization) {
        Toast.error("Niet alle resultaten zijn geladen. Gebruik dit niet voor te veel leden tegelijk.").show();
        return;
    }

    for (const member of fetcher.objects) {
        try {
            const item = RegisterItem.defaultFor(member, props.group, props.checkout.singleOrganization)
            props.checkout.cart.add(item)
        } catch (e) {
            // prob invalid
            return;
        }
    }
}

async function goNext() {
    if (saving.value) {
        return
    }

    saving.value = true
    try {
        await props.saveHandler(navigate)
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    } finally {
        saving.value = false
    }
}

</script>
