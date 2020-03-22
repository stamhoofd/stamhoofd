import { Member } from "./src/members/models/Member"

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
        const member = new Member();

        member.firstName = "Simon";

        await member.save();
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
