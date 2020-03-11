package graphql

import (
	"github.com/stamhoofd/stamhoofd/backend/auth/models"
)

func NewUser(user *models.User) *User {
	if user == nil {
		return nil
	}
	return &User{
		ID:    user.ID.String(),
		Email: user.Email,
	}
}

func NewRegisterResponse(user *models.User) *RegisterResponse {
	return &RegisterResponse{
		User: NewUser(user),
	}
}

func NewRegisterConfirmResponse(user *models.User) *RegisterConfirmResponse {
	return &RegisterConfirmResponse{
		User: NewUser(user),
	}
}

func NewResetPasswordResponse(passwordReset *models.PasswordReset) *ResetPasswordResponse {
	return &ResetPasswordResponse{
		Email: &passwordReset.User.Email,
	}
}

func NewResetPasswordConfirmResponse(user *models.User) *ResetPasswordConfirmResponse {
	return &ResetPasswordConfirmResponse{
		User: NewUser(user),
	}
}
