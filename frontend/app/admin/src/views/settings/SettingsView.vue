<template>
    <div id="settings-view" class="st-view background">
        <STNavigationBar title="Instellingen" />

        <main class="center">
            <h1>
                Instellingen
            </h1>

            <STList class="illustration-list">    
                <STListItem :selectable="true" class="left-center" @click="$navigate('beheerders')">
                    <template #left><img src="@stamhoofd/assets/images/illustrations/admin.svg"></template>
                    <h2 class="style-title-list">
                        {{ $t('admin.settings.admins.title') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('admin.settings.admins.description') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem :selectable="true" class="left-center" @click="$navigate('beheerders')">
                    <template #left>
                        <img src="@stamhoofd/assets/images/illustrations/health-data.svg">
                    </template>
                    <h2 class="style-title-list">
                        {{ $t('admin.settings.records.title') }}
                    </h2>
                    <p class="style-description">
                        {{ $t('admin.settings.records.description') }}
                    </p>
                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { ComponentOptions } from 'vue';
import {AdminsView} from '@stamhoofd/components';
 
defineRoutes([
    {
        url: 'beheerders',
        component: AdminsView as ComponentOptions,
    }
])
const $navigate = useNavigate()
</script>
