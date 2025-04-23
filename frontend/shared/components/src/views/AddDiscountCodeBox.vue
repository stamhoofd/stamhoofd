<template>
    <div class="container">
        <p v-if="!isEnteringDiscountCode">
            <button type="button" class="button text" @click="addDiscountCode">
                <span class="icon label" />
                <span>{{ $t('60c60897-68d9-4295-a260-295bd9574ff3') }}</span>
            </button>
        </p>
        <hr v-if="isEnteringDiscountCode"><form v-if="isEnteringDiscountCode" data-submit-last-field @submit.prevent="addEnteredCode">
            <STInputBox error-fields="code" :error-box="errorBox" class="max" :title="$t(`46a3962f-7d21-4cf4-b3a9-bfec8007e68a`)">
                <div class="split-inputs">
                    <input v-model="code" autofocus enterkeyhint="go" class="input" type="text" autocomplete="off" :placeholder="$t(`1bc69456-3b92-4744-905d-8dd06a219f0e`)" @blur="cleanCode"><LoadingButton :loading="loading">
                        <button class="button primary" type="submit">
                            {{ $t('70ab2aeb-5db1-45db-bf66-4f21441a8b12') }}
                        </button>
                    </LoadingButton>
                </div>
            </STInputBox>
        </form>
    </div>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Component, Prop, VueComponent } from '@simonbackx/vue-app-navigation/classes';
import { ErrorBox, LoadingButton, STInputBox, STList, STListItem } from '@stamhoofd/components';
import { Formatter } from '@stamhoofd/utility';

@Component({
    components: {
        STList,
        STListItem,
        LoadingButton,
        STInputBox,
    },
})
export default class AddDiscountCodeBox extends VueComponent {
    @Prop({ required: true })
    applyCode: (code: string) => Promise<boolean>;

    isEnteringDiscountCode = false;
    code = '';
    errorBox: ErrorBox | null = null;
    loading = false;

    addDiscountCode() {
        this.isEnteringDiscountCode = true;
    }

    cleanCode() {
        this.code = Formatter.slug(this.code.trim()).toUpperCase();
    }

    async addEnteredCode() {
        if (this.loading) {
            return;
        }
        this.loading = true;
        try {
            this.cleanCode();
            if (await this.applyCode(this.code)) {
                this.isEnteringDiscountCode = false;
                this.code = '';
            }
            else {
                this.errorBox = new ErrorBox(new SimpleError({
                    code: 'invalid_code',
                    field: 'code',
                    message: $t(`Deze kortingscode is ongeldig`),
                }));
            }
        }
        catch (e) {
            console.error(e);
            if (isSimpleError(e) || isSimpleErrors(e)) {
                e.addNamespace('code');
            }
            this.errorBox = new ErrorBox(e);
        }
        this.loading = false;
    }
}
</script>
