<template>
    <STListItem v-long-press="(e) => editRegistration(e)" :selectable="isEditable" class="left-center hover-box member-registration-block" @contextmenu.prevent="editRegistration($event)" @click.prevent="editRegistration($event)">
        <template #left>
            <figure v-if="imageSrc(registration)" class="registration-image">
                <img :src="imageSrc(registration)">
                <div>
                    <span v-if="registration.waitingList" class="icon gray clock" />
                </div>
            </figure>
            <figure v-else class="registration-image">
                <figure>
                    <span>{{ getGroup(registration.groupId).settings.getShortCode(2) }}</span>
                </figure>
                <div>
                    <span v-if="registration.waitingList" class="icon gray clock" />
                </div>
            </figure>
        </template>
        <h3 class="style-title-list">
            {{ getGroup(registration.groupId).settings.name }}
        </h3>
        <p v-if="!registration.waitingList" class="style-description-small">
            Ingeschreven op {{ formatDateTime(registration.registeredAt) }}
        </p>
        <p v-else class="style-description-small">
            Op wachtlijst sinds {{ formatDateTime(registration.createdAt) }}
        </p>
        <p v-if="registration.waitingList && registration.canRegister" class="style-description-small">
            Toegelaten om in te schrijven
        </p>

        <template v-if="isEditable" #right><span class="icon arrow-down-small gray" /></template>
    </STListItem>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { LongPressDirective, STListItem } from "@stamhoofd/components";
import { Registration } from '@stamhoofd/structures';
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";



@Component({
    components: {
        STListItem
    },
    directives: { 
        LongPress: LongPressDirective
    },
    filters: {
        dateTime: Formatter.dateTime.bind(Formatter)
    },
    emits: ["edit"]
})
export default class MemberRegistrationBlock extends Mixins(NavigationMixin) {
    @Prop()
    registration!: Registration;

    getGroup(groupId: string) {
        return this.$organization.groups.find(g => g.id === groupId)
    }

    get isEditable() {
        return !!this.$.vnode.props?.onEdit
    }

    editRegistration(event) {
        if (this.isEditable) {
            this.$emit("edit", event)
        }
    }

    imageSrc(registration: Registration) {
        const group = this.getGroup(registration.groupId)
        if (!group) {
            return null
        }
        return (group.settings.squarePhoto ?? group.settings.coverPhoto)?.getPathForSize(100, 100)
    }
}
</script>