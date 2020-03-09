package oauth2

import (
	"crypto/rand"
	"crypto/rsa"
	"os"
	"time"

	"github.com/go-chi/chi"
	"github.com/ory/fosite"
	"github.com/ory/fosite/compose"
	"github.com/ory/fosite/handler/openid"
	"github.com/ory/fosite/token/jwt"
)

func ServeOAuth2(router *chi.Mux) {
	router.HandleFunc("/oauth2/auth", authEndpoint)
	router.HandleFunc("/oauth2/token", tokenEndpoint)

	// revoke tokens
	router.HandleFunc("/oauth2/revoke", revokeEndpoint)
	router.HandleFunc("/oauth2/introspect", introspectionEndpoint)
}

// var config = new(compose.Config)
var config = &compose.Config{
	RefreshTokenScopes:         []string{},
	SendDebugMessagesToClients: true,
}

var strat = compose.CommonStrategy{
	CoreStrategy: compose.NewOAuth2HMACStrategy(
		config,
		[]byte(os.Getenv("SECRET")),
		nil,
	),
}

var oauth2Provider fosite.OAuth2Provider = compose.Compose(
	config,
	store,
	strat,
	nil,

	// Owner flow
	compose.OAuth2ResourceOwnerPasswordCredentialsFactory,

	compose.OAuth2TokenRevocationFactory,
	compose.OAuth2TokenIntrospectionFactory,
)

// A session is passed from the `/auth` to the `/token` endpoint. You probably want to store data like: "Who made the request",
// "What organization does that person belong to" and so on.
// For our use case, the session will meet the requirements imposed by JWT access tokens, HMAC access tokens and OpenID Connect
// ID Tokens plus a custom field

// newSession is a helper function for creating a new session. This may look like a lot of code but since we are
// setting up multiple strategies it is a bit longer.
// Usually, you could do:
//
//  session = new(fosite.DefaultSession)
func newSession(user string) *openid.DefaultSession {
	return &openid.DefaultSession{
		Claims: &jwt.IDTokenClaims{
			Issuer:      "http://localhost",
			Subject:     user,
			Audience:    []string{"http://localhost"},
			ExpiresAt:   time.Now().Add(time.Hour * 6),
			IssuedAt:    time.Now(),
			RequestedAt: time.Now(),
			AuthTime:    time.Now(),
		},
		Headers: &jwt.Headers{
			Extra: make(map[string]interface{}),
		},
	}
}

func mustRSAKey() *rsa.PrivateKey {
	key, err := rsa.GenerateKey(rand.Reader, 1024)
	if err != nil {
		panic(err)
	}
	return key
}
