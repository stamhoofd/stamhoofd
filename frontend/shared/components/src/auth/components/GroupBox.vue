<template>
    <button type="button" class="group-box" @click="navigate(ViewRoute)">
        <div class="left">
            <GroupAvatar :group="group" />
        </div>
        <div class="middle">
            <h3>
                {{ group.settings.name }}
            </h3>
            <p v-if="group.settings.whoShort">
                {{ group.settings.whoShort }}
            </p>
            <p class="tags-without-background">
                <GroupTag :group="group" />
            </p>
        </div>
    </button>
</template>

<script lang="ts" setup>
import GroupAvatar from '#GroupAvatar.vue';
import { defineRoute, useNavigate } from '@simonbackx/vue-app-navigation';
import type { Group } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import GroupTag from './GroupTag.vue';


const props = defineProps<{
    group: Group;
}>();

const navigate = useNavigate();

const ViewRoute = defineRoute({
    url: Formatter.slug(props.group.settings.name.toString()),
    component: async () => (await import('./GroupView.vue')).default,
    present: 'popup',
    defaultProperties() {
        return {
            group: props.group,
        };
    },
});
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.group-box {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 15px;
    align-items: center;
    background: $color-background;
    border-radius: $border-radius;
    border: $border-width-thin solid $color-border;
    @include style-side-view-shadow();
    padding: 9px;
    cursor: pointer;

    --color-current-background: #{$color-background};
    --color-current-background-shade: #{$color-background-shade};
    --color-current-background-shade-darker: #{$color-background-shade-darker};

    &:hover {
        background: $color-background-shade;

        --color-current-background: #{$color-background-shade};
        --color-current-background-shade: #{$color-background-shade-darker};
        --color-current-background-shade-darker: #{$color-background-shade-darker-darker};
    }

    &:active, &.active, &.focused {
        background: $color-background-shade-darker;
        --color-current-background: #{$color-background-shade-darker};
        --color-current-background-shade: #{$color-background-shade-darker-darker};
        --color-current-background-shade-darker: #{$color-background-shade-4};
    }

    .middle {
        padding: 7px 0;
        h3 {
            @extend %style-title-list;
        }

        p {
            @extend %style-description-small;
        }
    }
}
</style>
