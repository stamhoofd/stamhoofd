package oauth2

import (
	"os"
	"time"

	"github.com/go-chi/chi"
	"github.com/jinzhu/gorm"
	"github.com/ory/fosite"
	"github.com/ory/fosite/compose"
	"github.com/ory/fosite/handler/openid"
	"github.com/ory/fosite/token/jwt"
)

var oauth2Provider fosite.OAuth2Provider

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

func ServeOAuth2(db *gorm.DB, router *chi.Mux) {
	store = NewStore(db)
	oauth2Provider = compose.Compose(
		config,
		store,
		strat,
		nil,

		// Owner flow
		compose.OAuth2ResourceOwnerPasswordCredentialsFactory,
		compose.OAuth2RefreshTokenGrantFactory,

		compose.OAuth2TokenRevocationFactory,
		compose.OAuth2TokenIntrospectionFactory,
	)

	router.HandleFunc("/oauth2/token", tokenEndpoint)
	router.HandleFunc("/oauth2/revoke", revokeEndpoint)
	router.HandleFunc("/oauth2/introspect", introspectionEndpoint)
}

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
