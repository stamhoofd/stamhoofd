<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>
        <p v-if="organization && period.id !== organization.period.id">
            {{ period.period.name }}
        </p>
            
        <p v-if="isRoot && enableActivities">
            Voeg hier alle groepen toe waarin je jouw leden wilt onderverdelen. Als je geen onderverdeling wilt, kan je gewoon één groep toevoegen. Leden kunnen dan inschrijven voor één of meerdere inschrijvingsgroepen. Je kan ook categorieën toevoegen: een categorie is puur voor de structuur, zo kan je bijvoorbeeld een categorie maken voor al je danslessen, leeftijdsgroepen, activiteiten, weekends, kampen, ...
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
import { CenteredMessage, Checkbox, ErrorBox, STErrorsDefault, STInputBox, STList, SaveView, useAuth, useDraggableArrayIds, useErrors, usePatch } from "@stamhoofd/components";
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
const title = computed(() => isRoot.value ? 'Inschrijvingsgroepen'+(enableActivities.value ? " en activiteiten" : "") : (props.isNew ? "Nieuwe categorie" : name.value))
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
            startDate: new Date(),
            endDate: new Date(),
            prices: [],
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
            new ComponentWithProperties(EditGroupGeneralView, { 
                group, 
                period: patchedPeriod.value,
                organization: props.organization, 
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                    addPatch(p.patch(patch))
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
                period: patchedPeriod.value,
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

/*
@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        STList,
        GroupRow,
        GroupCategoryRow,
        LoadingButton,
        BackButton,
        Checkbox,
        STListItem
    },
})
export default class EditCategoryGroupsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false

    @Prop({ required: true })
        category: GroupCategory

    @Prop({ default: false })
        isNew!: boolean

    @Prop({ required: true })
        organization: Organization

    @Prop({ required: true })
        period: OrganizationRegistrationPeriod
    
    patchOrganization: AutoEncoderPatchType<Organization> = Organization.patch({})
    patchPeriod: AutoEncoderPatchType<OrganizationRegistrationPeriod> = OrganizationRegistrationPeriod.patch({})

    @Prop({ required: true })
        saveHandler: ((patch: AutoEncoderPatchType<Organization>) => Promise<void>);

    get isPublic() {
        return this.patchedCategory.isPublic(this.patchedOrganization.availableCategories)
    }

    get enableActivities() {
        return this.organization.meta.modules.useActivities
    }

    get patchedOrganization() {
        return this.organization.patch(this.patchOrganization)
    }

    get patchedPeriod() {
        return this.period.patch(this.patchPeriod)
    }

    get patchedCategory() {
        const c = this.patchedPeriod.settings.categories.find(c => c.id == this.category.id)
        if (c) {
            return c
        }
        return this.category
    }

    get isRoot() {
        return this.category.id === this.patchedPeriod.settings.rootCategoryId
    }

    get fullAccess() {
        return this.$context.organizationAuth.hasFullAccess()
    }

    get title() {
        return this.isRoot ? 'Inschrijvingsgroepen'+(this.enableActivities ? " en activiteiten" : "") : (this.isNew ? "Nieuwe categorie" : this.name)
    }

    get name() {
        return this.patchedCategory.settings.name
    }

    set name(name: string) {
        this.addCategoryPatch(
            GroupCategory.patch({ 
                settings: GroupCategorySettings.patch({
                    name
                })
            })
        )
    }

    get limitRegistrations() {
        return this.patchedCategory.settings.maximumRegistrations !== null
    }

    set limitRegistrations(limitRegistrations: boolean) {
        this.addCategoryPatch(
            GroupCategory.patch({ 
                settings: GroupCategorySettings.patch({
                    maximumRegistrations: limitRegistrations ? 1 : null
                })
            })
        )
    }

    get isHidden() {
        return !this.patchedCategory.settings.public
    }

    set isHidden(isHidden: boolean) {
        this.addCategoryPatch(
            GroupCategory.patch({ 
                settings: GroupCategorySettings.patch({
                    public: !isHidden
                })
            })
        )
    }

    get groups() {
        return this.patchedCategory.groupIds.flatMap(id => {
            const group = this.patchedPeriod.groups.find(g => g.id === id)
            if (group) {
                return [group]
            }
            return []
        })
    }

    get categories() {
        return this.patchedCategory.categoryIds.flatMap(id => {
            const category = this.patchedPeriod.settings.categories.find(c => c.id === id)
            if (category) {
                return [category]
            }
            return []
        })
    }

    addCategoryPatch(patch: AutoEncoderPatchType<GroupCategory>) {
        const meta = OrganizationMetaData.patch({})
        meta.categories.addPatch(GroupCategory.patch(Object.assign({}, patch, { id: this.category.id })))

        this.addPatch(Organization.patch({
            meta
        }))
    }

    addPermissionsPatch(patch: AutoEncoderPatchType<GroupCategoryPermissions>) {
        this.addCategoryPatch(GroupCategory.patch({
            settings: GroupCategorySettings.patch({
                permissions: GroupCategoryPermissions.patch(patch)
            })
        }))
    }

    addPatch(patch: AutoEncoderPatchType<Organization>) {
        this.patchOrganization = this.patchOrganization.patch(patch)
    }

    get draggableCategories() {
        return this.categories;
    }

    set draggableCategories(categories) {
        if (categories.length != this.categories.length) {
            return;
        }

        const patch = GroupCategory.patch({})
        for (const p of categories.slice().reverse()) {
            patch.categoryIds.addMove(p.id, null)
        }
        this.addCategoryPatch(patch)
    }

    get draggableGroups() {
        return this.groups;
    }

    set draggableGroups(groups) {
        if (groups.length != this.groups.length) {
            return;
        }

        const patch = GroupCategory.patch({})
        for (const p of groups.slice().reverse()) {
            patch.groupIds.addMove(p.id, null)
        }
        this.addCategoryPatch(patch)
    }

    deleteCategory(category: GroupCategory) {
        const p = GroupCategory.patch({})
        p.categoryIds.addDelete(category.id)
        this.addCategoryPatch(p)
    }

    moveCategoryUp(category: GroupCategory) {
        const index = this.patchedCategory.categoryIds.findIndex(id => category.id === id)
        if (index == -1 || index == 0) {
            return;
        }

        const moveTo = index - 2
        const p = GroupCategory.patch({})
        p.categoryIds.addMove(category.id, this.patchedCategory.categoryIds[moveTo] ?? null)
        this.addCategoryPatch(p)
    }

    moveCategoryDown(category: GroupCategory) {
        const index = this.patchedCategory.categoryIds.findIndex(id => category.id === id)
        if (index == -1 || index >= this.patchedCategory.categoryIds.length - 1) {
            return;
        }

        const moveTo = index + 1
        const p = GroupCategory.patch({})
        p.categoryIds.addMove(category.id, this.patchedCategory.categoryIds[moveTo])
        this.addCategoryPatch(p)
    }

    deleteGroup(group: Group) {
        const p = GroupCategory.patch({})
        p.groupIds.addDelete(group.id)
        this.addCategoryPatch(p)
    }

    moveGroupUp(group: Group) {
        const index = this.patchedCategory.groupIds.findIndex(id => group.id === id)
        if (index == -1 || index == 0) {
            return;
        }

        const moveTo = index - 2
        const p = GroupCategory.patch({})
        p.groupIds.addMove(group.id, this.patchedCategory.groupIds[moveTo] ?? null)
        this.addCategoryPatch(p)
    }

    moveGroupDown(group: Group) {
        const index = this.patchedCategory.groupIds.findIndex(id => group.id === id)
        if (index == -1 || index >= this.patchedCategory.groupIds.length - 1) {
            return;
        }

        const moveTo = index + 1
        const p = GroupCategory.patch({})
        p.groupIds.addMove(group.id, this.patchedCategory.groupIds[moveTo])
        this.addCategoryPatch(p)
    }

    async save() {
        this.saving = true
        try {
            await this.saveHandler(this.patchOrganization)
            this.pop({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.saving = false
    }

    
    cancel() {
        this.pop()
    }

    get hasChanges() {
        return patchContainsChanges(this.patchOrganization, this.organization, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
}
*/
</script>
