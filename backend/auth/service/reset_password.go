package service

import (
	"fmt"

	"github.com/jinzhu/gorm"
	"github.com/sirupsen/logrus"
	"github.com/stamhoofd/stamhoofd/backend/auth/models"
)

func ResetPassword(db *gorm.DB, email string) (*models.PasswordReset, error) {
	user := &models.User{}
	err := db.Where(&models.User{
		Email: email,
	}).First(user).Error
	if err != nil {
		return nil, fmt.Errorf("could not retrieve user %s: %w", email, err)
	}

	passwordReset := &models.PasswordReset{
		UserID: user.ID,
	}
	err = db.Create(passwordReset).Error
	if err != nil {
		return nil, fmt.Errorf("could not create password reset: %w", err)
	}

	logrus.Infof("created password reset for user: %v", user)
	return passwordReset, nil
}
