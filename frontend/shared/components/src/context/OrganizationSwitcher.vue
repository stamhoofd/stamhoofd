<template>
    <button v-long-press="() => open()" class="organization-switcher" :class="{small}" type="button" @click="open" @contextmenu.prevent="open">
        <ContextLogo :organization="organization" :app="app" />

        <div>
            <h1>
                <span>{{ small && organization ? organization.name : getAppTitle(app, organization) }}</span><span v-if="small" ref="arrow" class="icon arrow-down-small gray" />
            </h1>
            <h2 v-if="!small && getAppDescription(app, organization)">
                <span>{{ getAppDescription(app, organization) }}</span>
                <span ref="arrow" class="icon arrow-down-small gray" />
            </h2>
        </div>
    </button>
</template>

<script setup lang="ts">
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';

import { useOrganization } from '../hooks';
import { getAppDescription, getAppTitle, useAppContext } from './appContext';
import ContextLogo from './ContextLogo.vue'
import OrganizationAppSelector from './OrganizationAppSelector.vue';

const present = usePresent();
const organization = useOrganization();
const app = useAppContext();

withDefaults(
    defineProps<{
        small?: boolean
    }>(),
    {
        small: false
    }
)

const open = async () => {
    await present({
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

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.organization-switcher {
    display: grid;
    grid-template-columns: calc(var(--block-width, 40px) + 15px) 1fr;
    align-items: center;
    text-align: left;

    &:active {
        opacity: 0.4;
    }

    touch-action: manipulation;
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
    user-select: none;
    cursor: pointer;

    > figure {
        min-width: 0;
        padding-right: 15px;
    }

    &.small {
        --block-width: 30px;
        
        > div h1 {
            font-size: 16px;
        }
    }

    > div {
        min-width: 0;

        h1 {
            font-size: 16px;
            line-height: 1;
            font-weight: $font-weight-semibold;
            max-width: auto;
            width: 100%;
            height: 20px;

            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            min-width: 0;
            max-width: auto;

            @media (max-width: 600px) {
                font-size: 21px;
                margin-bottom: 3px;
            }
        }

        h2 {
            color: $color-gray-4;
            font-size: 13px;
            line-height: 1;
            overflow: hidden;
            display: flex;
            align-items: center;
            margin-bottom: -6px; // Fix alignment

            > span:first-child {
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
                max-width: auto;
                min-width: none;
            }

            > span:last-child {
                min-width: 24px;
            }
        }
    }
}
</style>
