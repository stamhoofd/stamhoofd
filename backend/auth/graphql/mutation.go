package graphql

import (
	"context"

	"github.com/stamhoofd/stamhoofd/backend/auth/service"
)

type mutationResolver struct{ *Resolver }

func (r *mutationResolver) Register(ctx context.Context, request RegisterRequest) (*RegisterResponse, error) {
	user, err := service.Register(r.DB, request.Email, request.Password)
	if err != nil {
		return nil, err
	}
	return NewRegisterResponse(user), nil
}

func (r *mutationResolver) RegisterConfirm(ctx context.Context, request RegisterConfirmRequest) (*RegisterConfirmResponse, error) {
	user, err := service.RegisterConfirm(r.DB, request.Email, request.Token)
	if err != nil {
		return nil, err
	}
	return NewRegisterConfirmResponse(user), nil
}

func (r *mutationResolver) ResetPassword(ctx context.Context, request ResetPasswordRequest) (*ResetPasswordResponse, error) {
	passwordReset, err := service.ResetPassword(r.DB, request.Email)
	if err != nil {
		return nil, err
	}
	return NewResetPasswordResponse(passwordReset), nil
}

func (r *mutationResolver) ResetPasswordConfirm(ctx context.Context, request ResetPasswordConfirmRequest) (*ResetPasswordConfirmResponse, error) {
	user, err := service.ResetPasswordConfirm(r.DB, request.Email, request.Token, request.Password)
	if err != nil {
		return nil, err
	}
	return NewResetPasswordConfirmResponse(user), nil
}
