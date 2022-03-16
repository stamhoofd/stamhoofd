import { Migration } from '@simonbackx/simple-database';
import { Member } from '@stamhoofd/models';
import { Address } from '@stamhoofd/structures';
import { StringCompare } from '@stamhoofd/utility';

import { AddressValidator } from '../helpers/AddressValidator';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    return Promise.resolve()

    /*let lastId = ""

    while(true) {
        const members = await Member.where({
            id: {
                sign: ">",
                value: lastId
            },
        }, {
            limit: 100,
            sort: ["id"]
        })

        if (members.length == 0) {
            return
        }

        lastId = members[members.length - 1].id

        for (const member of members) {
            if (member.details) {
                const addresses = [member.details.address, ...member.details.parents.map(p => p.address)].filter(a => a !== null) as Address[]

                for (const address of addresses) {
                    try {
                        const validatedAddress = await AddressValidator.validate(address)
                        const s = address.toString()
                        const e = validatedAddress.toString()
                        if (s != e) {
                            if (StringCompare.typoCount(address.street, validatedAddress.street) > 4) {
                                console.log("Updated street: " + s + " => " + e)
                            }
                            if (StringCompare.typoCount(address.city, validatedAddress.city) > 4) {
                                //console.log("Updated city: " + s + " => " + e)
                            }
                        }
                    } catch (e) {
                        console.error("Invalid address: " + address.toString()+" — "+e.message)
                    }
                }

            }
        }
    }

    throw new Error("WIP")*/
});


