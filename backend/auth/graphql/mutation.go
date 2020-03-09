package graphql

import (
	"context"

	"github.com/stamhoofd/stamhoofd/backend/auth/service"
)

type mutationResolver struct{ *Resolver }

func (r *mutationResolver) Register(ctx context.Context, email, password string) (*User, error) {
	user, err := service.Register(r.DB, email, password)
	if err != nil {
		return nil, err
	}
	return NewUser(user), nil
}

func (r *mutationResolver) RegisterConfirm(ctx context.Context, email, token string) (*LoggedInResponse, error) {
	loggedInResponse, err := service.RegisterConfirm(r.DB, email, token)
	if err != nil {
		return nil, err
	}
	return NewLoggedInResponse(loggedInResponse), nil
}

func (r *mutationResolver) Login(ctx context.Context, email, password string) (*LoggedInResponse, error) {
	loggedInResponse, err := service.Login(r.DB, email, password)
	if err != nil {
		return nil, err
	}
	return NewLoggedInResponse(loggedInResponse), nil
}

func (r *mutationResolver) ResetPassword(ctx context.Context, email string) (*ResetPasswordResponse, error) {
	passwordReset, err := service.ResetPassword(r.DB, email)
	if err != nil {
		return nil, err
	}
	return NewResetPasswordResponse(passwordReset), nil
}

func (r *mutationResolver) ResetPasswordConfirm(ctx context.Context, email, token, password string) (*LoggedInResponse, error) {
	loggedInResponse, err := service.ResetPasswordConfirm(r.DB, email, token, password)
	if err != nil {
		return nil, err
	}
	return NewLoggedInResponse(loggedInResponse), nil
}
