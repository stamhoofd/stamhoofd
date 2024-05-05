<template>
    <button v-long-press="() => open()" class="organization-switcher" type="button" @click="open" @contextmenu.prevent="open">
        <ContextLogo :organization="organization" :app="app" />

        <div>
            <h1>
                {{ getAppTitle(app, organization) }}
            </h1>
            <h2>
                <span>{{ getAppDescription(app, organization) }}</span>
                <span ref="arrow" class="icon arrow-down-small gray" />
            </h2>
        </div>
    </button>
</template>

<script setup lang="ts">
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import OrganizationAppSelector from './OrganizationAppSelector.vue';
import { useOrganization } from '../VueGlobalHelper';
import { getAppDescription, getAppTitle, useAppContext } from './appContext';
import ContextLogo from './ContextLogo.vue'

const present = usePresent();
const organization = useOrganization();
const app = useAppContext();

const open = () => {
    present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(OrganizationAppSelector, {})
            }, {
                provide: {
                    reactive_navigation_disable_url: true
                }
            })
        ],
        modalDisplayStyle: 'popup',
        modalClass: 'positionable-sheet',
        modalCssStyle: '--sheet-position-left: 20px; --sheet-position-top: 65px; --sheet-vertical-padding: 15px;',
        
    })
}
</script>