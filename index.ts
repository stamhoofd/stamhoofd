import { Member } from "./src/members/models/Member"
import { Model } from './src/database/classes/Model';

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
        const [found] = await Member.where({ key: "id", value: 9999 }).get()
        let member: Member
        if (found) {
            console.log("Found member " + found.firstName)
            member = found
        } else {
            console.log("Didn't find member")
            member = new Member();
        }

        member.firstName = "Simon";
        member.lastName = "Backx";

        await member.save(true);
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
