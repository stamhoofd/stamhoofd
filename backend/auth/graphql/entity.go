package graphql

import (
	"context"

	"github.com/stamhoofd/stamhoofd/backend/auth/service"
)

type entityResolver struct {
	*Resolver
}

func (r *entityResolver) FindUserByID(ctx context.Context, id string) (*User, error) {
	user, err := service.FindUserByID(
		r.DB,
		id,
	)
	if err != nil {
		return nil, err
	}

	return NewUser(user), nil
}
