const { ApolloServer } = require("apollo-server");
const { ApolloGateway, RemoteGraphQLDataSource } = require("@apollo/gateway");

class AuthenticatedDataSource extends RemoteGraphQLDataSource {
    willSendRequest({ request, context }) {
        const user = {
            email: "name@example.com"
        };
        const scopes = ["owner"];

        if (user) {
            request.http.headers.set("User", JSON.stringify(user));
        }

        request.http.headers.set("Scopes", scopes.join(","));
    }
}

const authService = process.env["AUTH_SERVICE"];
// const emailService = process.env["EMAIL_SERVICE"];
// const memberService = process.env["MEMBER_SERVICE"];

const gateway = new ApolloGateway({
    serviceList: [
        { name: "auth", url: `http://${authService}` }
        // { name: "email", url: `http://${emailService}/` },
        // { name: "member", url: `http://${memberService}/` }
    ],
    buildService({ name, url }) {
        return new AuthenticatedDataSource({ url });
    }
});

// const { schema, executor } = await gateway.load();
const server = new ApolloServer({
    gateway,
    subscriptions: false
});

server.listen().then(({ url }) => {
    console.log(`Gateway serving at: ${url}`);
});
