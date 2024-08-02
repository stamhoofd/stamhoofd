<template>
    <ExternalOrganizationContainer v-slot="{externalOrganization: groupOrganization}" :organization-id="group.organizationId" @update="setOrganization">
        <SaveView save-text="Inschrijven" :save-badge="cartLength" :disabled="cartLength === 0" title="Inschrijven">
            <p v-if="!checkout.isAdminFromSameOrganization" class="style-title-prefix">
                {{ groupOrganization!.name }}
            </p>
            <h1>Leden inschrijven voor {{ group.settings.name }}</h1>

          
            
            <STList v-if="calculatedMembers.length">
                <MemberRegisterItemCheckboxRow
                    v-for="member in calculatedMembers" 
                    :key="member.id" 
                    :member="member" 
                    :group="group" 
                    :group-organization="groupOrganization" 
                />
            </STList>

            <p v-if="!calculatedMembers.length" class="info-box">
                Nog geen selectie gemaakt
            </p>

            <p class="style-button-bar">
                <button type="button" class="button text" @click="addMember">
                    <span class="icon add" />
                    <span>Splinternieuw lid</span>
                </button>
            </p>

            <hr>
            <h2>Zoek bestaande leden</h2>

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
                Snel selecteren:  <button class="inline-link" type="button" @click="selectAllResults" v-if="canSelectAll">
                    Selecteer alles
                </button>

                <button class="inline-link" type="button" @click="selectAllResults" v-else-if="canUnselectAll">
                    Deselecteer alles
                </button>
            </p>

            <STList v-if="fetcher.objects.length">
                <MemberRegisterItemCheckboxRow
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
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { ExternalOrganizationContainer, getAdvancedMemberWithRegistrationsBlobUIFilterBuilders, InfiniteObjectFetcherEnd, Toast, UIFilter, UIFilterEditor, useInfiniteObjectFetcher, usePositionableSheet } from '@stamhoofd/components';
import { assertSort, Group, isEmptyFilter, LimitedFilteredRequest, MembersBlob, Organization, PaginatedResponseDecoder, PlatformFamily, PlatformMember, RegisterCheckout, RegisterItem, SortItemDirection, SortList } from '@stamhoofd/structures';
import { computed, markRaw, reactive, Ref, ref, watchEffect } from 'vue';
import { EditMemberGeneralBox, MemberStepView } from '.';
import { useAuth, useContext, useOrganization, usePlatform } from '../hooks';
import { NavigationActions } from '../types/NavigationActions';
import MemberRegisterItemCheckboxRow from './components/group/MemberRegisterItemCheckboxRow.vue';

type ObjectType = PlatformMember;

const props = defineProps<{
    members: PlatformMember[]
    group: Group
    checkout: RegisterCheckout, // we should auto assign this checkout to all search results and newly created members
}>();

function setOrganization(groupOrganization: Organization) {
    props.checkout.setDefaultOrganization(groupOrganization)
}

const searchQuery = ref('');
const selectedUIFilter = ref(null) as Ref<null|UIFilter>;

const context = useContext();
const contextOrganization = useOrganization()
const platform = usePlatform();
const present = usePresent()
const {presentPositionableSheet} = usePositionableSheet()

const calculatedMembers = computed(() => {
    const base = new Set(props.members)
    for (const item of props.checkout.cart.items) {
        base.add(item.member)
    }
    return Array.from(base)
});
const cartLength = computed(() => props.checkout.cart.items.length)
const auth = useAuth();

const filterBuilders = getAdvancedMemberWithRegistrationsBlobUIFilterBuilders(platform.value, {
    user: auth.user,
})

async function addMember() {
    const family = new PlatformFamily({
        contextOrganization: contextOrganization.value,
        platform: platform.value
    })
    family.checkout = props.checkout
    const member = reactive(family.newMember() as any) as PlatformMember
    
    const component = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(MemberStepView, {
            title: 'Nieuw lid',
            member,
            component: markRaw(EditMemberGeneralBox), // Only this step, because it could be a reused member
            doSave: true,
            saveHandler: async (navigate: NavigationActions) => {
                await navigate.dismiss({force: true})
                props.members.push(member)

                // todo: wire up views to check member information
            }
        }),
    });
    
    await present({
        components: [component],
        modalDisplayStyle: "popup"
    });
}

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

async function selectAllResults() {
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

</script>
