<template>
    <div class="st-view background category-view">
        <STNavigationBar :title="title" />

        <main>
            <h1 class="style-navigation-title with-icons" :class="{button: !!parentCategories.length}" @click="openCategorySelector">
                {{ title }}
                <span v-if="!isPublic" v-tooltip="'Deze categorie is enkel zichtbaar voor beheerders (leden die geen beheerder zijn kunnen zichtzelf niet inschrijven). Je kan dit aanpassen bij de instellingen van deze categorie.'" class="icon lock small" />
                <span v-if="parentCategories.length" class="button icon arrow-swap" />
            </h1>

            <STErrorsDefault :error-box="errorBox" />

            <template v-if="categories.length > 0">
                <STList>
                    <STListItem v-if="categories.length > 1" :selectable="true" class="left-center" @click="openAll(true)">
                        <template #left>
                            <span class="icon group" />
                        </template>

                        <h2 class="style-title-list bolder">
                            Alle leden
                        </h2>
                        <p class="style-description-small">
                            Bekijk alle leden samen
                        </p>
                        <template #right>
                            <span v-if="getMemberCount() !== null" class="style-description-small">{{ getMemberCount() }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-for="category in categories" :key="category.id" :selectable="true" @click="openCategory(category)">
                        <template #left>
                            <span v-if="category.categories.length" class="icon category" />
                            <span v-else class="icon category" />
                        </template>

                        {{ category.settings.name }}

                        <template #right>
                            <span v-if="category.getMemberCount() !== null" class="style-description-small">{{ category.getMemberCount() }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-else-if="groups.length > 0">
                <STList>
                    <STListItem v-if="groups.length > 1" :selectable="true" class="left-center" @click="openAll(true)">
                        <template #left>
                            <span class="icon group" />
                        </template>

                        <h2 class="style-title-list bolder">
                            Alle leden in deze categorie
                        </h2>
                        <template #right>
                            <span v-if="getMemberCount() !== null" class="style-description-small">{{ getMemberCount() }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-for="group in groups" :key="group.id" :selectable="true" @click="openGroup(group)">
                        <template #left>
                            <GroupAvatar :group="group" />
                        </template>
                        <h3 class="style-title-list">
                            {{ group.settings.name }}
                        </h3>
                        <template #right>
                            <span v-if="group.getMemberCount() !== null" class="style-description-small">{{ group.getMemberCount() }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>

                <p v-if="canCreate" class="style-button-bar">
                    <button class="button text" type="button" @click="createGroup">
                        <span class="icon add" />
                        <span>Inschrijvingsgroep</span>
                    </button>
                </p>
            </template>

            <p v-if="categories.length === 0 && groups.length === 0 && canCreate" class="info-box">
                Deze inschrijvingscategorie is leeg, maak zelf inschrijvingsgroepen aan waarin leden kunnen inschrijven.
            </p>
            <p v-else-if="categories.length === 0 && groups.length === 0" class="info-box">
                Deze inschrijvingscategorie is leeg. Vraag een hoofdbeheerder om groepen aan te maken.
            </p>

            <p v-if="categories.length === 0 && groups.length === 0 && canCreate">
                <button class="button text" type="button" @click="createGroup">
                    <span class="icon add" />
                    <span>Nieuwe groep</span>
                </button>
            </p>
        </main>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { BackButton, ContextMenu, ContextMenuItem, EditGroupView, ErrorBox, GroupAvatar, MembersTableView, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from '@stamhoofd/components';
import { Group, GroupCategory, GroupCategoryTree, GroupPrivateSettings, GroupSettings, GroupStatus, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings } from '@stamhoofd/structures';
import GroupOverview from './GroupOverview.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        STList,
        STListItem,
        BackButton,
        GroupAvatar,
    },
})
export default class CategoryView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null;
    validator = new Validator();
    saving = false;

    @Prop({ required: true })
    category: GroupCategory;

    @Prop({ required: true })
    period: OrganizationRegistrationPeriod;

    get parentCategories() {
        return [
            ...(!this.isRoot && this.period.settings.rootCategory ? [this.period.settings.rootCategory] : []),
            ...this.category.getParentCategories(this.period.availableCategories),
        ];
    }

    get isPublic() {
        return this.tree.isPublic(this.period.availableCategories);
    }

    openCategorySelector(event: MouseEvent) {
        if (this.parentCategories.length === 0) {
            return;
        }

        const actions: ContextMenuItem[] = [];

        for (const parent of this.parentCategories) {
            actions.unshift(new ContextMenuItem({
                name: parent.id === this.period.settings.rootCategoryId ? 'Alle inschrijvingsgroepen' : parent.settings.name,
                icon: 'category',
                action: () => {
                    this.swapCategory(parent);
                    return true;
                },
            }));
        }
        const menu = new ContextMenu([
            [
                new ContextMenuItem({
                    name: this.title,
                    icon: 'category',
                    disabled: true,
                    action: () => {
                        return true;
                    },
                }),
                ...actions,
            ],
        ]);
        menu.show({ clickEvent: event, xPlacement: 'right', yPlacement: 'bottom' }).catch(console.error);
    }

    swapCategory(category: GroupCategory) {
        this.show({
            components: [new ComponentWithProperties(CategoryView, {
                category,
                period: this.period,
            })],
            replace: this.navigationController?.components?.length ?? 1,
            animated: false,
        });
    }

    get reactiveCategory() {
        const c = this.period.settings.categories.find(c => c.id === this.category.id);
        if (c) {
            return c;
        }
        return this.category;
    }

    getMemberCount({ waitingList }: { waitingList?: boolean } = {}) {
        return this.tree.getMemberCount({ waitingList });
    }

    get tree() {
        return GroupCategoryTree.build(this.reactiveCategory, this.period, { permissions: this.$context.auth.permissions });
    }

    get organization() {
        return this.$organization;
    }

    get isRoot() {
        return this.category.id === this.organization.meta.rootCategoryId;
    }

    get title() {
        return this.isRoot ? 'Alle inschrijvingsgroepen' : this.name + '';
    }

    get name() {
        return this.reactiveCategory.settings.name;
    }

    get canCreate() {
        return this.$context.auth.canCreateGroupInCategory(this.category);
    }

    get groups() {
        return this.tree.groups;
    }

    get categories() {
        return this.tree.categories;
    }

    openCategory(category: GroupCategory) {
        this.show(new ComponentWithProperties(CategoryView, {
            category,
            period: this.period,
        }));
    }

    openGroup(group: Group) {
        this.show(new ComponentWithProperties(GroupOverview, {
            group,
            period: this.period,
        }));
    }

    openAll(animated = true) {
        this.show({
            components: [
                new ComponentWithProperties(MembersTableView, {
                    category: this.tree,
                    periodId: this.period.period.id,
                }),
            ],
            animated,
        });
    }

    createGroup() {
        const group = Group.create({
            organizationId: this.organization.id,
            periodId: this.period.period.id,
            settings: GroupSettings.create({}),
            privateSettings: GroupPrivateSettings.create({}),
            status: GroupStatus.Closed,
        });
        const settings = OrganizationRegistrationPeriodSettings.patch({});

        const me = GroupCategory.patch({ id: this.category.id });
        me.groupIds.addPut(group.id);
        settings.categories.addPatch(me);

        this.present(new ComponentWithProperties(EditGroupView, {
            group,
            isNew: true,
            saveHandler: async (patch: AutoEncoderPatchType<Group>) => {
                const p = OrganizationRegistrationPeriod.patch({
                    id: this.period.id,
                    settings,
                });
                p.groups.addPut(group.patch(patch));
                await this.$organizationManager.patchPeriod(p);
            },
        }).setDisplayStyle('popup'));
    }
}
</script>

<style lang="scss">
    .category-view {
        --block-width: 24px;
    }
</style>
