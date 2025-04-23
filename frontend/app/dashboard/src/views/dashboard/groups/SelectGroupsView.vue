<template>
    <div id="parent-view" class="st-view">
        <STNavigationBar :title="$t(`508832fa-ae9f-4357-81d6-279c68e23ae0`)" />

        <main>
            <h1>
                {{ $t('31aee3be-f11e-48f8-ba66-9b59f68a7ac8') }}
            </h1>

            <STErrorsDefault :error-box="errorBox" />

            <div v-for="category in categoryTree.categories" :key="category.id" class="container">
                <hr><h2>{{ category.settings.name }}</h2>
                <STList>
                    <STListItem v-for="group in category.groups" :key="group.id" :selectable="true" element-name="label" class="right-stack left-center">
                        <template #left>
                            <Checkbox :model-value="getSelectedGroup(group)" @update:model-value="setSelectedGroup(group, $event)" />
                        </template>
                        <h2 class="style-title-list">
                            {{ group.settings.name }}
                        </h2>
                    </STListItem>
                </STList>
            </div>

            <template v-if="allowArchived">
                <Spinner v-if="loadingGroups" />
                <template v-else-if="archivedGroups.length">
                    <hr><h2>{{ $t('c51b35d1-228b-4ce3-8b27-312b5620b662') }}</h2>

                    <STList>
                        <STListItem v-for="group in archivedGroups" :key="group.id" :selectable="true" element-name="label" class="right-stack left-center">
                            <template #left>
                                <Checkbox :model-value="getSelectedGroup(group)" @update:model-value="setSelectedGroup(group, $event)" />
                            </template>
                            <h2 class="style-title-list">
                                {{ group.settings.name }}
                            </h2>
                        </STListItem>
                    </STList>
                </template>
            </template>

            <p v-if="categoryTree.categories.length === 0 && archivedGroups.length === 0 && !loadingGroups" class="info-box">
                {{ $t('8587ccc4-1b08-4bc1-b3e5-88989aa580cc') }}
            </p>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="save">
                        {{ $t('a103aa7c-4693-4bd2-b903-d14b70bfd602') }}
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Request } from '@simonbackx/simple-networking';
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { CenteredMessage, Checkbox, ErrorBox, LoadingButton, Spinner, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Toast, Validator } from '@stamhoofd/components';
import { Group } from '@stamhoofd/structures';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STErrorsDefault,
        STInputBox,
        Spinner,
        Checkbox,
        STList,
        STListItem,
        LoadingButton,
    },
})
export default class SelectGroupsView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    initialGroupIds!: string[];

    @Prop({ default: true })
    allowArchived!: boolean;

    groupIds = this.initialGroupIds.slice();

    @Prop({ required: true })
    callback: (groupIds: string[]) => Promise<void>;

    errorBox: ErrorBox | null = null;
    loading = false;
    validator = new Validator();

    archivedGroups: Group[] = [];
    loadingGroups = true;

    get categoryTree() {
        return this.$organization.getCategoryTree({ maxDepth: 1, admin: true, smartCombine: true });
    }

    mounted() {
        this.load().catch(console.error);
    }

    getSelectedGroup(group: Group): boolean {
        return this.groupIds.includes(group.id);
    }

    setSelectedGroup(group: Group, selected: boolean) {
        if (selected) {
            if (this.getSelectedGroup(group) === selected) {
                return;
            }
            this.groupIds.push(group.id);
        }
        else {
            const index = this.groupIds.findIndex(id => id === group.id);
            if (index !== -1) {
                this.groupIds.splice(index, 1);
            }
        }
    }

    async save() {
        if (this.loading) {
            return;
        }
        this.loading = true;

        try {
            await this.callback(this.groupIds);
            this.errorBox = null;
            this.loading = false;
            this.dismiss({ force: true });
            return true;
        }
        catch (e) {
            this.errorBox = new ErrorBox(e);
            this.loading = false;
            return false;
        }
    }

    async shouldNavigateAway() {
        if (this.groupIds.join(',') === this.initialGroupIds.join(',')) {
            return true;
        }
        return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
    }

    async load() {
        if (!this.allowArchived) {
            this.loadingGroups = false;
            return;
        }

        try {
            this.archivedGroups = (await this.$organizationManager.loadArchivedGroups({ owner: this }));
        }
        catch (e) {
            Toast.fromError(e).show();
        }
        this.loadingGroups = false;
    }

    beforeUnmount() {
        // Cancel all requests
        Request.cancelAll(this);
    }
}
</script>
