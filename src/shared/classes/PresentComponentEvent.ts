import { Component, Prop, Vue } from "vue-property-decorator";

export class PresentComponentEvent {
    component: any;

    constructor(component: any) {
        this.component = component;
    }
}
