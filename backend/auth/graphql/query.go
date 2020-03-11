package graphql

import (
	"context"
)

type queryResolver struct{ *Resolver }

var user = &User{
	ID:    "1",
	Email: "name@example.com",
}

func (r *queryResolver) Me(ctx context.Context) (*User, error) {
	return user, nil
}
