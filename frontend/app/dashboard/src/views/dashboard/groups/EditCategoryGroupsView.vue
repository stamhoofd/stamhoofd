<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}

            <span v-if="organization" class="title-suffix">
                {{ period.period.nameShort }}
            </span>
        </h1>
            
        <p v-if="isRoot && enableActivities">
            Voeg hier alle groepen toe waarin je jouw leden wilt onderverdelen in {{ period.period.name }}. Je kan ook categorieën toevoegen: een categorie is puur voor de structuur, zo kan je bijvoorbeeld een categorie maken voor al je leeftijdsgroepen en één voor al je vrijwilligers.
        </p>
          
        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox v-if="!isRoot" title="Naam" error-fields="name" :error-box="errors.errorBox">
            <input
                ref="firstInput"
                v-model="name"
                class="input"
                type="text"
                placeholder="Naam van deze categorie"
                autocomplete=""
            >
        </STInputBox>

        <template v-if="enableActivities">
            <Checkbox v-if="categories.length == 0" v-model="limitRegistrations">
                Een lid kan maar in één groep inschrijven
            </Checkbox>

            <Checkbox v-if="!isRoot" v-model="isHidden">
                Toon deze categorie enkel voor beheerders
            </Checkbox>

            <p v-if="!isRoot && !isHidden && !isPublic" class="warning-box">
                Een bovenliggende categorie is enkel zichtbaar voor beheerders, dus deze categorie is bijgevolg ook enkel zichtbaar voor beheerders.
            </p>
        </template>

        <template v-if="categories.length > 0">
            <hr>
            <h2>Categorieën</h2>
            <STList v-model="draggableCategories" :draggable="true">
                <template #item="{item: category}">
                    <GroupCategoryRow :category="category" :period="patchedPeriod" :organization="organization" @patch:period="addPatch" />
                </template>
            </STList>
        </template>

        <template v-if="groups.length > 0 || categories.length == 0">
            <hr>
            <h2>Groepen</h2>
            <STList v-model="draggableGroups" :draggable="true">
                <template #item="{item: group}">
                    <GroupRow :group="group" :period="patchedPeriod" :organization="organization" @patch:period="addPatch" />
                </template>
            </STList>
        </template>

        <p v-if="categories.length == 0">
            <button class="button text" type="button" @click="createGroup">
                <span class="icon add" />
                <span>Nieuwe groep</span>
            </button>
        </p>
        <p v-if="enableActivities">
            <button class="button text" type="button" @click="createCategory">
                <span class="icon add" />
                <span v-if="groups.length == 0">Nieuwe categorie</span>
                <span v-else>Opdelen in categorieën</span>
            </button>
        </p>

        <div v-if="isRoot && auth.hasFullAccess()" class="container">
            <hr>
            <h2>Prullenmand inschrijvingsgroepen</h2>
            <p>Per ongeluk een inschrijvingsgroep verwijderd? Hier haal je de inschrijvingsgroep en daarbij horende leden terug.</p>
            <button type="button" class="button text" @click="openGroupTrash">
                <span class="icon trash" /><span>Open prullenmand</span>
            </button>
        </div>

        <div v-if="!isNew && !isRoot && enableActivities" class="container">
            <hr>
            <h2>
                Verwijder deze categorie
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>Verwijderen</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, EditGroupView, ErrorBox, STErrorsDefault, STInputBox, STList, SaveView, useAuth, useDraggableArrayIds, useErrors, usePatch } from "@stamhoofd/components";
import { Group, GroupCategory, GroupCategorySettings, GroupGenderType, GroupPrivateSettings, GroupSettings, Organization, OrganizationGenderType, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings } from "@stamhoofd/structures";

import { computed, getCurrentInstance, ref } from 'vue';
import GroupCategoryRow from "./GroupCategoryRow.vue";
import GroupRow from "./GroupRow.vue";
import GroupTrashView from './GroupTrashView.vue';
import EditGroupGeneralView from './edit/EditGroupGeneralView.vue';

// Self reference
const instance = getCurrentInstance()
const EditCategoryGroupsView = instance!.type

const props = defineProps<{
    organization: Organization
    category: GroupCategory
    isNew: boolean
    period: OrganizationRegistrationPeriod
    saveHandler: ((patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => Promise<void>);
}>()

const {patched: patchedPeriod, hasChanges, patch, addPatch} = usePatch(props.period)
const enableActivities = computed(() => props.organization.meta.modules.useActivities);
const saving = ref(false)
const pop = usePop()
const errors = useErrors()
const present = usePresent()
const auth = useAuth();

const patchedCategory = computed(() => {
    const c = patchedPeriod.value.settings.categories.find(c => c.id == props.category.id)
    if (c) {
        return c
    }
    return props.category
})

const isRoot = computed(() => props.category.id === patchedPeriod.value.settings.rootCategoryId)
const title = computed(() => isRoot.value ? 'Inschrijvingsgroepen' : (props.isNew ? "Nieuwe categorie" : name.value))
const name = computed({
    get: () => patchedCategory.value.settings.name,
    set: (name: string) => {
        addCategoryPatch(GroupCategory.patch({ 
            settings: GroupCategorySettings.patch({
                name
            })
        }))
    }
})
const limitRegistrations = computed({
    get: () => patchedCategory.value.settings.maximumRegistrations !== null,
    set: (limitRegistrations: boolean) => {
        addCategoryPatch(
            GroupCategory.patch({ 
                settings: GroupCategorySettings.patch({
                    maximumRegistrations: limitRegistrations ? 1 : null
                })
            })
        )
    }
})
const isHidden = computed({
    get: () => !patchedCategory.value.settings.public,
    set: (isHidden: boolean) => {
        addCategoryPatch(
            GroupCategory.patch({ 
                settings: GroupCategorySettings.patch({
                    public: !isHidden
                })
            })
        )
    }
})
const isPublic = computed(() => patchedCategory.value.isPublic(patchedPeriod.value.settings.categories))

const categories = computed(() => {
    return patchedCategory.value.categoryIds.flatMap(id => {
        const category = patchedPeriod.value.settings.categories.find(c => c.id === id)
        if (category) {
            return [category]
        }
        return []
    })
})

const draggableCategories = useDraggableArrayIds(() => {
    return categories.value
}, (patch: PatchableArray<string, string, string>) => {
    addCategoryPatch(GroupCategory.patch({
        categoryIds: patch
    }))
})

const groups = computed(() => {
    return patchedCategory.value.groupIds.flatMap(id => {
        const group = patchedPeriod.value.groups.find(g => g.id === id)
        if (group) {
            return [group]
        }
        return []
    })
})

const draggableGroups = useDraggableArrayIds(() => {
    return groups.value
}, (patch: PatchableArray<string, string, string>) => {
    addCategoryPatch(GroupCategory.patch({
        groupIds: patch
    }))
})

function addCategoryPatch(patch: AutoEncoderPatchType<GroupCategory>) {
    const settings = OrganizationRegistrationPeriodSettings.patch({})
    patch.id = props.category.id
    settings.categories.addPatch(patch)

    addPatch(OrganizationRegistrationPeriod.patch({
        settings
    }))
}

async function save() {
    if (saving.value) {
        return
    }

    saving.value = true

    try {
        await props.saveHandler(patch.value)
        await pop({ force: true })
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }
    saving.value = false
}

async function createGroup() {
    const group = Group.create({
        organizationId: props.organization.id,
        periodId: props.organization.period.period.id,
        settings: GroupSettings.create({
            name: "",
            genderType: props.organization.meta.genderType == OrganizationGenderType.Mixed ? GroupGenderType.Mixed : GroupGenderType.OnlyFemale
        }),
        privateSettings: GroupPrivateSettings.create({})
    })

    const settings = OrganizationRegistrationPeriodSettings.patch({})

    const me = GroupCategory.patch({ id: props.category.id })
    me.groupIds.addPut(group.id)
    settings.categories.addPatch(me)

    const p = OrganizationRegistrationPeriod.patch({
        settings
    })

    p.groups.addPut(group)
    
    await present({
        components: [
            new ComponentWithProperties(EditGroupView, { 
                group, 
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<Group>) => {
                    p.groups.addPatch(patch)
                    addPatch(p)
                }
            })
        ],
        modalDisplayStyle: "popup"
    })
}

async function createCategory() {
    const category = GroupCategory.create({})
    category.groupIds = patchedCategory.value.categoryIds.length == 0 ? patchedCategory.value.groupIds : []
    
    const settings = OrganizationRegistrationPeriodSettings.patch({})
    settings.categories.addPut(category)

    const me = GroupCategory.patch({ 
        id: props.category.id,
        groupIds: [] as any
    })

    me.categoryIds.addPut(category.id)
    settings.categories.addPatch(me)

    const p = OrganizationRegistrationPeriod.patch({
        settings
    })
    
    await present({
        components: [
            new ComponentWithProperties(EditCategoryGroupsView, { 
                category: category, 
                organization: props.organization,
                period: patchedPeriod.value.patch(p),
                isNew: true,
                saveHandler: async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                    addPatch(p.patch(patch))
                }
            })
        ],
        modalDisplayStyle: "popup"
    })
}

async function openGroupTrash() {
    await present({
        components: [
            new ComponentWithProperties(GroupTrashView, { }).setDisplayStyle("popup")
        ],
        modalDisplayStyle: "popup"
    })
}

async function deleteMe() {
    if (!await CenteredMessage.confirm(groups.value.length ? "Ben je zeker dat je deze categorie en groepen wilt verwijderen?" : "Ben je zeker dat je deze categorie wilt verwijderen?", "Verwijderen")) {
        return
    }
    const settings = OrganizationRegistrationPeriodSettings.patch({})
    settings.categories.addDelete(props.category.id)
    const p = OrganizationRegistrationPeriod.patch({
        settings
    })
    await props.saveHandler(p)
    await pop({ force: true })
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
}

defineExpose({
    shouldNavigateAway
})
</script>
