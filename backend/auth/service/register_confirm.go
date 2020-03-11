package service

import (
	"fmt"

	"github.com/jinzhu/gorm"
	"github.com/stamhoofd/stamhoofd/backend/auth/models"
)

func RegisterConfirm(db *gorm.DB, email, token string) (*models.User, error) {
	user := &models.User{}
	err := db.Where(&models.User{
		Email:             email,
		RegistrationToken: token,
	}).First(user).Error
	if err != nil {
		return nil, fmt.Errorf("could not retrieve user %s: %w", email, err)
	}

	err = db.Model(user).Update("registration_token", "").Error
	if err != nil {
		return nil, fmt.Errorf("could not update registration token for user %v: %w", user, err)
	}
	return user, nil
}
