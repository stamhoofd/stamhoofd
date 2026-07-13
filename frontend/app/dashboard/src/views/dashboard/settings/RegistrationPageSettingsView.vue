<template>
    <div id="registration-page-settings-view" class="st-view background">
        <STNavigationBar :title="$t(`%Oa`)" />

        <main>
            <h1>{{ $t('%Oa') }}</h1>

            <p class="style-description">
                {{ $t('%42') }}
            </p>

            <hr><h2 class="style-with-button">
                <div>{{ $t('%Oa') }}</div>
                <div>
                    <a :href="organization.registerUrl" target="_blank" rel="noopener" class="button text">
                        <span class="icon external" />
                        <span class="hide-small">{{ $t('%Ob') }}</span>
                    </a>
                </div>
            </h2>

            <input v-tooltip="$t('%Ip')" class="input" :value="organization.registerUrl" readonly @click="copyElement"><p class="info-box">
                {{ $t('%2u') }}
            </p>

            <hr><h2>{{ $t('%Oc') }}</h2>

            <STList>
                <STListItem :selectable="true" element-name="a" :href="$domains.getDocs('')" target="_blank">
                    <template #left>
                        <span class="icon link" />
                    </template>
                    {{ $t('%xW') }}
                </STListItem>

                <STListItem :selectable="true" element-name="a" :href="$domains.getDocs('tag/ledenadministratie-instellen')" target="_blank">
                    <template #left>
                        <span class="icon link" />
                    </template>
                    {{ $t('%Od') }}
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import Tooltip from '@stamhoofd/components/overlays/Tooltip.vue';

const organization = useRequiredOrganization();
const present = usePresent();

async function copyElement(event: MouseEvent) {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) {
        return;
    }

    target.contentEditable = 'true';
    document.execCommand('selectAll', false);
    document.execCommand('copy');
    target.contentEditable = 'false';

    const displayedComponent = new ComponentWithProperties(Tooltip, {
        text: '📋 Gekopieerd!',
        x: event.clientX,
        y: event.clientY + 10,
    });
    await present(displayedComponent.setDisplayStyle('overlay'));

    setTimeout(() => {
        (displayedComponent.componentInstance() as { hide?: () => void } | null)?.hide?.();
    }, 1000);
}
</script>
