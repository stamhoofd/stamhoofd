import { Model } from "../classes/Model";

export function manyToOne(_field: string) {
    return (_target: Model, _key) => {
        //target.relations.push(key)
    };
}
