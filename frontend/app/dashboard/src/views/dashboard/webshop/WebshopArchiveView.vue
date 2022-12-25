<template>
    <div class="st-view background">
        <STNavigationBar title="Webshop archief" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>
                Webshop archief
            </h1>
            <p>Deze webshops werden gearchiveerd en zijn niet langer actief.</p>
          
            <STList>
                <STListItem v-for="webshop in webshops" :key="webshop.id" :selectable="true" @click="openWebshop(webshop)">
                    {{ webshop.meta.name }}

                    <template slot="right">
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, LoadComponent, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { WebshopPreview, WebshopStatus } from "@stamhoofd/structures";
import { Sorter } from "@stamhoofd/utility";
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from '../../../classes/OrganizationManager';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        STList,
        STListItem,
        BackButton
    },
})
export default class WebshopArchiveView extends Mixins(NavigationMixin) {
    mounted() {
        UrlHelper.setUrl("/webshop-archive")    
        document.title = "Stamhoofd - Webshop archief"
    }

    get organization() {
        return OrganizationManager.organization
    }

    get webshops() {
        return this.organization.webshops
            .filter(webshop => webshop.meta.status === WebshopStatus.Archived)
            .sort((a, b) => Sorter.byStringValue(a.meta.name, b.meta.name))
    }

    async openWebshop(webshop: WebshopPreview) {
        this.show({
            components: [
                new ComponentWithProperties(NavigationController, { 
                    root: await LoadComponent(() => import(/* webpackChunkName: "WebshopOverview" */ './WebshopOverview.vue'), { preview: webshop }, { instant: false })
                })
            ]}
        );
    }
}
</script>
