import { Member } from "./src/members/models/Member"
import { Address } from './src/members/models/Address';
import { RelationLoaded, RelationSet } from './src/database/classes/ToOneRelation';

process.on('unhandledRejection', (error: Error) => {
    console.error("unhandledRejection")
    console.error(error.message, error.stack);
    process.exit(1);
});

// Set timezone!
process.env.TZ = "UTC"

// Quick check
if (new Date().getTimezoneOffset() != 0) {
    throw new Error("Process should always run in UTC timezone")
}

const start = async () => {
    try {
        const [found] = await Member.where({ key: "id", value: 67 }).with(Member.address).get()
        let member: Member & RelationSet<typeof Member.address>;

        if (found) {
            console.log("Found member " + found.firstName)

            // Move address of Simon
            if (!found.hasRelation(Member.address)) {
                const address = new Address()
                address.city = "Moved"
                address.country = "BE"
                address.street = "Straatnaam"
                address.number = "123"
                address.postalCode = "9000"
                await address.save()
                member = found.setRelation(Member.address, address)
            } else {
                member = found
            }

        } else {
            console.log("Didn't find member")
            const address = new Address()
            address.city = "Demo"
            address.country = "BE"
            address.street = "Straatnaam"
            address.number = "123"
            address.postalCode = "9000"
            await address.save()

            member = new Member().setRelation(Member.address, address);
        }

        /*if (!member.hasRelation(Member.address)) {
            member = member.setRelation(Member.address, new Address())
            member.address.city = "Demo"
            member.address.country = "BE"
            member.address.street = "Straatnaam"
            member.address.number = "123"
            member.address.postalCode = "9000"
            await member.address.save()
        } else {
            // Move address of Simon

            member.address = new Address()
            member.address.city = "Moved"
            member.address.country = "BE"
            member.address.street = "Straatnaam"
            member.address.number = "123"
            member.address.postalCode = "9000"
            await member.address.save()
        }*/

        member.logCountry()

        console.log(`${member.firstName} woont in ${member.address.city}`);

        member.firstName = "Simon";
        member.lastName = "Backx";

        await member.save();
        member.lastName = "";
        member.lastName = "Backx";
        await member.save();
        console.log("Done.")
    } catch (e) {
        console.error("Failed to save member: ", e);
    }

};

start().catch((error) => {
    console.error('unhandledRejection', error);
    process.exit(1);
}).finally(() => {
    process.exit();
});
