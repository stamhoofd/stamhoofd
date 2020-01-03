package models

import "github.com/google/uuid"

type PasswordReset struct {
	Model

	UserID uuid.UUID
	User   User
}
