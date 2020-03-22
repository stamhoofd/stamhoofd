import { Model } from "../classes/Model";

export function manyToOne(field: string) {
    return (target: Model, key) => {
        //target.relations.push(key)
    };
}
