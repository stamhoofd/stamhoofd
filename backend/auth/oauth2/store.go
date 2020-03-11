package oauth2

import (
	"context"
	"os"

	"github.com/jinzhu/gorm"
	"github.com/ory/fosite"
	"github.com/ory/fosite/handler/oauth2"
	"github.com/pkg/errors"
	"github.com/stamhoofd/stamhoofd/backend/auth/service"
)

type Store struct {
	oauth2.AccessTokenStorage
	oauth2.RefreshTokenStorage

	db *gorm.DB

	Clients       map[string]fosite.Client
	AccessTokens  map[string]fosite.Requester
	RefreshTokens map[string]fosite.Requester
	// In-memory request ID to token signatures
	AccessTokenRequestIDs  map[string]string
	RefreshTokenRequestIDs map[string]string
}

var store *Store

func NewStore(db *gorm.DB) *Store {
	return &Store{
		db: db,
		Clients: map[string]fosite.Client{
			// This is the client that should be used by the frontend.
			// It gives access to password login and refresh tokens.
			"frontend": &fosite.DefaultClient{
				ID:            "frontend",
				ResponseTypes: []string{"id_token", "code", "token"},
				GrantTypes:    []string{"refresh_token", "password"},
				Scopes:        []string{},
				Public:        true,
			},
			// This client should be exclusively used by the backend.
			// It allows for token introspection.
			"backend": &fosite.DefaultClient{
				ID:            "frontend",
				Secret:        []byte(os.Getenv("OAUTH2_BACKEND_SECRET")),
				ResponseTypes: []string{"id_token", "code", "token"},
				GrantTypes:    []string{"introspection"},
				Scopes:        []string{},
				Public:        false,
			},
		},
		AccessTokens:           map[string]fosite.Requester{},
		RefreshTokens:          map[string]fosite.Requester{},
		AccessTokenRequestIDs:  map[string]string{},
		RefreshTokenRequestIDs: map[string]string{},
	}
}

func (s *Store) GetClient(ctx context.Context, id string) (fosite.Client, error) {
	cl, ok := s.Clients[id]
	if !ok {
		return nil, fosite.ErrNotFound
	}
	return cl, nil
}

func (s *Store) Authenticate(ctx context.Context, email string, password string) error {
	_, err := service.Login(s.db, email, password)
	if err != nil {
		return errors.Wrap(fosite.ErrNotFound, err.Error())
	}
	return nil
}

func (s *Store) CreateAccessTokenSession(ctx context.Context, signature string, req fosite.Requester) error {
	s.AccessTokens[signature] = req
	s.AccessTokenRequestIDs[req.GetID()] = signature
	return nil
}

func (s *Store) GetAccessTokenSession(ctx context.Context, signature string, session fosite.Session) (fosite.Requester, error) {
	rel, ok := s.AccessTokens[signature]
	if !ok {
		return nil, fosite.ErrNotFound
	}
	return rel, nil
}

func (s *Store) DeleteAccessTokenSession(ctx context.Context, signature string) error {
	delete(s.AccessTokens, signature)
	return nil
}

func (s *Store) RevokeAccessToken(ctx context.Context, requestID string) error {
	if signature, exists := s.AccessTokenRequestIDs[requestID]; exists {
		s.DeleteAccessTokenSession(ctx, signature)
	}
	return nil
}

func (s *Store) CreateRefreshTokenSession(ctx context.Context, signature string, req fosite.Requester) error {
	s.RefreshTokens[signature] = req
	s.RefreshTokenRequestIDs[req.GetID()] = signature
	return nil
}

func (s *Store) GetRefreshTokenSession(ctx context.Context, signature string, session fosite.Session) (fosite.Requester, error) {
	rel, ok := s.RefreshTokens[signature]
	if !ok {
		return nil, fosite.ErrNotFound
	}
	return rel, nil
}

func (s *Store) DeleteRefreshTokenSession(ctx context.Context, signature string) error {
	delete(s.RefreshTokens, signature)
	return nil
}

func (s *Store) RevokeRefreshToken(ctx context.Context, requestID string) error {
	if signature, exists := s.RefreshTokenRequestIDs[requestID]; exists {
		s.DeleteRefreshTokenSession(ctx, signature)
		s.DeleteAccessTokenSession(ctx, signature)
	}
	return nil
}

func (s *Store) CreateAuthorizeCodeSession(ctx context.Context, code string, req fosite.Requester) error {
	panic("Authorize requests are not supported.")
}

func (s *Store) GetAuthorizeCodeSession(ctx context.Context, code string, session fosite.Session) (fosite.Requester, error) {
	panic("Authorize requests are not supported.")
}

func (s *Store) InvalidateAuthorizeCodeSession(ctx context.Context, code string) error {
	panic("Authorize requests are not supported.")
}
