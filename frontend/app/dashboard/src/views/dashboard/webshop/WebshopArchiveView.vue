<template>
    <div class="st-view background">
        <STNavigationBar title="Webshop archief" />

        <main>
            <h1>
                Webshop archief
            </h1>
            <p>Deze webshops werden gearchiveerd en zijn niet langer actief.</p>

            <STList>
                <STListItem v-for="webshop in webshops" :key="webshop.id" :selectable="true" @click="openWebshop(webshop)">
                    {{ webshop.meta.name }}

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import { BackButton, LoadComponent, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar } from '@stamhoofd/components';
import { WebshopPreview, WebshopStatus } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        STList,
        STListItem,
        BackButton,
    },
})
export default class WebshopArchiveView extends Mixins(NavigationMixin) {
    get organization() {
        return this.$organization;
    }

    get webshops() {
        return this.organization.webshops
            .filter(webshop => webshop.meta.status === WebshopStatus.Archived)
            .sort((a, b) => Sorter.byStringValue(a.meta.name, b.meta.name));
    }

    async openWebshop(webshop: WebshopPreview) {
        this.show({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: await LoadComponent(() => import(/* webpackChunkName: "WebshopOverview" */ './WebshopOverview.vue'), { preview: webshop }, { instant: false }),
                }),
            ] },
        );
    }
}
</script>
