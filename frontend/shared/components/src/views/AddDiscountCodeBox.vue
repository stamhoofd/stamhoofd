<template>
    <div class="container">
        <p v-if="!isEnteringDiscountCode">
            <button type="button" class="button text" @click="addDiscountCode">
                <span class="icon label"/>
                <span>{{ $t('8ff65df4-0850-4a8c-aa3a-a4d7e089536b') }}</span>
            </button>
        </p>
        <hr v-if="isEnteringDiscountCode"><form v-if="isEnteringDiscountCode" @submit.prevent="addEnteredCode" data-submit-last-field>
            <STInputBox error-fields="code" :error-box="errorBox" class="max" :title="$t(`2f4e2886-2c75-47d7-8bc4-5ace1a8d3a33`)">
                <div class="split-inputs">
                    <input v-model="code" autofocus enterkeyhint="go" class="input" type="text" autocomplete="off" @blur="cleanCode" :placeholder="$t(`2f687230-1314-4944-b1a7-f9869c5c6021`)"><LoadingButton :loading="loading">
                        <button class="button primary" type="submit">
                            {{ $t('d50d247e-e460-499a-a648-505c35798f65') }}
                        </button>
                    </LoadingButton>
                </div>
            </STInputBox>
        </form>
    </div>
</template>


<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { ErrorBox, LoadingButton, STInputBox, STList, STListItem } from '@stamhoofd/components';
import { Formatter } from '@stamhoofd/utility';
import { Component, Prop, VueComponent } from '@simonbackx/vue-app-navigation/classes';

@Component({
    components: {
        STList,
        STListItem,
        LoadingButton,
        STInputBox
    }
})
export default class AddDiscountCodeBox extends VueComponent {
    @Prop({required: true })
    applyCode: (code: string) => Promise<boolean>

    isEnteringDiscountCode = false;
    code = ''
    errorBox: ErrorBox | null = null
    loading = false

    addDiscountCode() {
        this.isEnteringDiscountCode = true
    }

    cleanCode() {
        this.code = Formatter.slug(this.code.trim()).toUpperCase()
    }


    async addEnteredCode() {
        if (this.loading) {
            return;
        }
        this.loading = true;
        try {
            this.cleanCode()
            if (await this.applyCode(this.code)) {
                this.isEnteringDiscountCode = false
                this.code = ""
            } else {
                this.errorBox = new ErrorBox(new SimpleError({
                    code: 'invalid_code',
                    field: 'code',
                    message: 'Deze kortingscode is ongeldig'
                }))
            }
        } catch (e) {
            console.error(e)
            if (isSimpleError(e) || isSimpleErrors(e)) {
                e.addNamespace('code')
            }
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

}
</script>
