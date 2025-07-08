<template>
    <PlatformLogo v-if="!organization && (app === 'auto' || (app === 'registration' && !canSwitch))" />
    <OrganizationLogo v-else-if="(app === 'registration' && organization) || !canSwitch" :organization="organization" />
    <button v-else v-long-press="($event) => open($event)" class="organization-switcher" :class="{small}" type="button" @click="open" @contextmenu.prevent="open($event)">
        <ContextLogo :organization="organization" :app="app" />
        <div>
            <h1>
                <span>{{ small && organization ? organization.name : getAppTitle(app, organization) }}</span><span v-if="small" class="icon arrow-down-small gray" />
            </h1>
            <h2 v-if="!small && getAppDescription(app, organization) && canSwitch">
                <span>{{ getAppDescription(app, organization) }}</span>
                <span v-if="canSwitch" class="icon arrow-down-small gray" />
                <span v-else class="icon dot" />
            </h2>
        </div>
    </button>
</template>

<script setup lang="ts">
import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';

import { useOrganization } from '../hooks';
import { usePositionableSheet } from '../tables';
import { useAppContext, useAppData } from './appContext';
import ContextLogo from './ContextLogo.vue';
import { useContextOptions } from './hooks/useContextOptions';
import OrganizationAppSelector from './OrganizationAppSelector.vue';
import OrganizationLogo from './OrganizationLogo.vue';
import PlatformLogo from './PlatformLogo.vue';

const organization = useOrganization();
const app = useAppContext();
const { presentPositionableSheet } = usePositionableSheet();
const { getAppTitle, getAppDescription } = useAppData();
const { getDefaultOptions } = useContextOptions();

const options = getDefaultOptions();
const hasAdmin = options.some(o => o.app === 'admin');
const canSwitch = options.length > 1 || ((STAMHOOFD.userMode !== 'platform' || hasAdmin) && !STAMHOOFD.singleOrganization);

withDefaults(
    defineProps<{
        small?: boolean;
    }>(),
    {
        small: false,
    },
);

const open = async (event: MouseEvent) => {
    if (!canSwitch) {
        return;
    }

    await presentPositionableSheet(event, {
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(OrganizationAppSelector, {}),
            }, {
                provide: {
                    reactive_navigation_disable_url: true,
                },
            }),
        ],
    }, { padding: 25 });
};
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
