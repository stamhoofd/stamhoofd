package graphql

import (
	"github.com/stamhoofd/stamhoofd/backend/auth/models"
)

func NewUser(user *models.User) *User {
	return &User{
		ID:    user.ID.String(),
		Email: user.Email,
	}
}

func NewResetPasswordResponse(passwordReset *models.PasswordReset) *ResetPasswordResponse {
	return &ResetPasswordResponse{
		User: NewUser(&passwordReset.User),
	}
}

func NewLoggedInResponse(loggedInResponse *models.LoggedInResponse) *LoggedInResponse {
	return &LoggedInResponse{
		User:  NewUser(&loggedInResponse.User),
		Token: loggedInResponse.Token,
	}
}
