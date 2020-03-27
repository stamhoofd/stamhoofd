import { CreateMember } from './src/endpoints/CreateMember';
import { Request } from './src/routing/classes/Request';

console.log("Start");
// Test endpoint
const createMemberEndpoint = new CreateMember()
const r = new Request();
r.body = JSON.stringify({
    firstName: "Simon",
    lastName: "Backx",
    records: [{
        name: "hallo"
    }]
});
r.headers['Content-Type'] = "application/vnd.stamhoofd.Member+json;version=2";
r.headers['Accept'] = "application/vnd.stamhoofd.Member+json;version=1";

try {
    const response = createMemberEndpoint.run(r);
    if (response) {
        console.log(response.body)
    }

} catch (err) {
    console.error(err);
}
