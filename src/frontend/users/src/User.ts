import { Data,Encodeable } from '@stamhoofd-common/encoding'

export class User implements Encodeable {
    email: string

    constructor(data: { email: string}) {
        this.email = data.email
    }

    static decode(data: Data): User {
        return new User({
            email: data.field("email").string
        })
    }

    encode() {
        return {
            email: this.email
        }
    }
}