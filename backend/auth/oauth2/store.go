package oauth2

import (
	"context"
	"errors"

	"github.com/ory/fosite"
	"github.com/ory/fosite/handler/oauth2"
)

type Store struct {
	oauth2.CoreStorage

	Clients        map[string]fosite.Client
	AuthorizeCodes map[string]StoreAuthorizeCode
	IDSessions     map[string]fosite.Requester
	AccessTokens   map[string]fosite.Requester
	Implicit       map[string]fosite.Requester
	RefreshTokens  map[string]fosite.Requester
	PKCES          map[string]fosite.Requester
	Users          map[string]MemoryUserRelation
	// In-memory request ID to token signatures
	AccessTokenRequestIDs  map[string]string
	RefreshTokenRequestIDs map[string]string
}

// This is an exemplary storage instance. We will add a client and a user to it so we can use these later on.
var store = &Store{
	IDSessions: make(map[string]fosite.Requester),
	Clients: map[string]fosite.Client{
		"frontend": &fosite.DefaultClient{
			ID:            "frontend",
			ResponseTypes: []string{"id_token", "code", "token"},
			GrantTypes:    []string{"refresh_token", "password"},
			Scopes:        []string{},
			Public:        true,
		},
	},
	Users: map[string]MemoryUserRelation{
		"andreas": {
			// This store simply checks for equality, a real storage implementation would obviously use
			// a hashing algorithm for encrypting the user password.
			Username: "andreas",
			Password: "secret",
		},
	},
	AuthorizeCodes:         map[string]StoreAuthorizeCode{},
	Implicit:               map[string]fosite.Requester{},
	AccessTokens:           map[string]fosite.Requester{},
	RefreshTokens:          map[string]fosite.Requester{},
	PKCES:                  map[string]fosite.Requester{},
	AccessTokenRequestIDs:  map[string]string{},
	RefreshTokenRequestIDs: map[string]string{},
}

type MemoryUserRelation struct {
	Username string
	Password string
}

type StoreAuthorizeCode struct {
	active bool
	fosite.Requester
}

func (s *Store) GetClient(_ context.Context, id string) (fosite.Client, error) {
	cl, ok := s.Clients[id]
	if !ok {
		return nil, fosite.ErrNotFound
	}
	return cl, nil
}

func (s *Store) Authenticate(_ context.Context, name string, secret string) error {
	// panic(errors.New("Authenticate"))
	rel, ok := s.Users[name]
	if !ok {
		return fosite.ErrNotFound
	}
	if rel.Password != secret {
		return errors.New("Invalid credentials")
	}
	return nil
}

func (s *Store) CreateAccessTokenSession(_ context.Context, signature string, req fosite.Requester) error {
	// panic(errors.New("CreateAccessTokenSession"))
	s.AccessTokens[signature] = req
	s.AccessTokenRequestIDs[req.GetID()] = signature
	return nil
}

func (s *Store) GetAccessTokenSession(_ context.Context, signature string, _ fosite.Session) (fosite.Requester, error) {
	rel, ok := s.AccessTokens[signature]
	if !ok {
		return nil, fosite.ErrNotFound
	}
	return rel, nil
}

func (s *Store) DeleteAccessTokenSession(_ context.Context, signature string) error {
	delete(s.AccessTokens, signature)
	return nil
}

func (s *Store) RevokeAccessToken(ctx context.Context, requestID string) error {
	if signature, exists := s.AccessTokenRequestIDs[requestID]; exists {
		s.DeleteAccessTokenSession(ctx, signature)
	}
	return nil
}

func (s *Store) CreateRefreshTokenSession(_ context.Context, signature string, req fosite.Requester) error {
	// panic(errors.New("CreateRefreshTokenSession"))
	s.RefreshTokens[signature] = req
	s.RefreshTokenRequestIDs[req.GetID()] = signature
	return nil
}

func (s *Store) GetRefreshTokenSession(_ context.Context, signature string, _ fosite.Session) (fosite.Requester, error) {
	rel, ok := s.RefreshTokens[signature]
	if !ok {
		return nil, fosite.ErrNotFound
	}
	return rel, nil
}

func (s *Store) DeleteRefreshTokenSession(_ context.Context, signature string) error {
	// panic(errors.New("DeleteRefreshTokenSession"))
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

// func (s *Store) CreateAuthorizeCodeSession(_ context.Context, code string, req fosite.Requester) error {
// 	panic(errors.New("CreateAuthorizeCodeSession"))
// 	s.AuthorizeCodes[code] = StoreAuthorizeCode{active: true, Requester: req}
// 	return nil
// }

// func (s *Store) GetAuthorizeCodeSession(_ context.Context, code string, _ fosite.Session) (fosite.Requester, error) {
// 	panic(errors.New("GetAuthorizeCodeSession"))
// 	rel, ok := s.AuthorizeCodes[code]
// 	if !ok {
// 		return nil, fosite.ErrNotFound
// 	}
// 	if !rel.active {
// 		return rel, fosite.ErrInvalidatedAuthorizeCode
// 	}

// 	return rel.Requester, nil
// }

// func (s *Store) InvalidateAuthorizeCodeSession(ctx context.Context, code string) error {
// 	panic(errors.New("InvalidateAuthorizeCodeSession"))
// 	rel, ok := s.AuthorizeCodes[code]
// 	if !ok {
// 		return fosite.ErrNotFound
// 	}
// 	rel.active = false
// 	s.AuthorizeCodes[code] = rel
// 	return nil
// }

// func (s *Store) DeleteAuthorizeCodeSession(_ context.Context, code string) error {
// 	panic(errors.New("DeleteAuthorizeCodeSession"))
// 	delete(s.AuthorizeCodes, code)
// 	return nil
// }

// func (s *Store) CreatePKCERequestSession(_ context.Context, code string, req fosite.Requester) error {
// 	panic(errors.New("CreatePKCERequestSession"))
// 	s.PKCES[code] = req
// 	return nil
// }

// func (s *Store) GetPKCERequestSession(_ context.Context, code string, _ fosite.Session) (fosite.Requester, error) {
// 	rel, ok := s.PKCES[code]
// 	if !ok {
// 		return nil, fosite.ErrNotFound
// 	}
// 	return rel, nil
// }

// func (s *Store) DeletePKCERequestSession(_ context.Context, code string) error {
// 	panic(errors.New("DeletePKCERequestSession"))
// 	delete(s.PKCES, code)
// 	return nil
// }

// func (s *Store) CreateImplicitAccessTokenSession(_ context.Context, code string, req fosite.Requester) error {
// 	panic(errors.New("CreateImplicitAccessTokenSession"))
// 	s.Implicit[code] = req
// 	return nil
// }
