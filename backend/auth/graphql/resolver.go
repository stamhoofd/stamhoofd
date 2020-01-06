package graphql

import (
	"context"

	"github.com/jinzhu/gorm"
	"github.com/stamhoofd/stamhoofd/backend/auth/models"
	"github.com/stamhoofd/stamhoofd/backend/auth/service"
)

type Resolver struct {
	DB *gorm.DB
}

func (r *Resolver) Mutation() MutationResolver {
	return &mutationResolver{r}
}
func (r *Resolver) Query() QueryResolver {
	return &queryResolver{r}
}

type mutationResolver struct{ *Resolver }

var user = &User{
	ID:    "1",
	Email: "name@example.com",
}
var loggedInResponse = &LoggedInResponse{
	User:  user,
	Token: "token",
}
var resetPasswordResponse = &ResetPasswordResponse{
	Email: user.Email,
}

func NewUser(user *models.User) *User {
	return &User{
		ID:    user.ID.String(),
		Email: user.Email,
	}
}

func (r *mutationResolver) Register(ctx context.Context, email, password string) (*User, error) {
	user, err := service.Register(r.DB, email, password)
	if err != nil {
		return nil, err
	}
	return NewUser(user), nil
}

func (r *mutationResolver) RegisterConfirm(ctx context.Context, email, token string) (*LoggedInResponse, error) {
	user, err := service.RegisterConfirm(r.DB, email, token)
	if err != nil {
		return nil, err
	}
	return &LoggedInResponse{
		User:  NewUser(user),
		Token: user.AuthenticationToken,
	}, nil
}

func (r *mutationResolver) Login(ctx context.Context, email, password string) (*LoggedInResponse, error) {
	return loggedInResponse, nil
}

func (r *mutationResolver) ResetPassword(ctx context.Context, email string) (*ResetPasswordResponse, error) {
	return resetPasswordResponse, nil
}

func (r *mutationResolver) ResetPasswordConfirm(ctx context.Context, email, token string) (*LoggedInResponse, error) {
	return loggedInResponse, nil
}

type queryResolver struct{ *Resolver }

func (r *queryResolver) Me(ctx context.Context) (*User, error) {
	return user, nil
}
