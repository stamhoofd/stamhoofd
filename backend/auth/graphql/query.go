package graphql

import (
	"context"

	"github.com/sirupsen/logrus"
)

type queryResolver struct{ *Resolver }

var user = &User{
	ID:    "1",
	Email: "name@example.com",
}

func (r *queryResolver) Me(ctx context.Context) (*User, error) {
	logrus.Infof("context: %v", ctx)
	logrus.Infof("result_context: %v", ctx.Value("result_context"))
	logrus.Infof("operation_context: %v", ctx.Value("operation_context"))
	logrus.Infof("user: %v", ctx.Value("user"))
	logrus.Infof("scopes: %v", ctx.Value("scopes"))
	return user, nil
}
