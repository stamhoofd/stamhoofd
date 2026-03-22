<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main>
            <h1>
                {{ title }}
            </h1>

            <p>
                {{ $t('%L7') }}
            </p>

            <Spinner v-if="loadingGroups" />
            <STList v-else-if="groups.length">
                <STListItem v-for="group in groups" :key="group.id" :selectable="true" @click="openGroup(group)">
                    <template #left>
                        <GroupAvatar :group="group" />
                    </template>

                    <h2 class="style-title-list">
                        {{ group.settings.name }}
                    </h2>

                    <template #right>
                        <span v-if="group.settings.registeredMembers !== null" class="style-description-small">{{ group.settings.registeredMembers }}</span>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
            <p v-else class="info-box">
                {{ $t('%KB') }}
            </p>
        </main>
    </div>
</template>

<script lang="ts">
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import GroupAvatar from '@stamhoofd/components/GroupAvatar.vue';
import Spinner from '@stamhoofd/components/Spinner.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import type { Group } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import GroupOverview from './GroupOverview.vue';

@Component({
    components: {
        STNavigationBar,
        STList,
        GroupAvatar,
        STListItem,
        Spinner,
    },
})
export default class ArchivedGroupsView extends Mixins(NavigationMixin) {
    loadingGroups = true;
    groups: Group[] = [];

    get title() {
        return 'Leden archief';
    }

    mounted() {
        // Load deleted groups
        this.load().catch(console.error);
    }

    async load() {
        try {
            this.groups = await this.$organizationManager.loadArchivedGroups({ owner: this });
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

    get organization() {
        return this.$organization;
    }

    get allCategories() {
        return this.organization.getCategoryTree({ admin: true, permissions: this.$context.organizationPermissions }).getAllCategories().filter(c => c.categories.length === 0);
    }

    async openGroup(group: Group) {
        await this.show({
            components: [
                new ComponentWithProperties(GroupOverview, {
                    group,
                }),
            ],
        });
    }
}
</script>
