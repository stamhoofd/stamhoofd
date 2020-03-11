package service

import (
	"fmt"

	"github.com/jinzhu/gorm"
	"github.com/stamhoofd/stamhoofd/backend/auth/models"
	"golang.org/x/crypto/bcrypt"
)

func Login(db *gorm.DB, email, password string) (*models.User, error) {
	user := &models.User{}
	err := db.Where(&models.User{
		Email: email,
	}).First(user).Error
	if err != nil {
		return nil, fmt.Errorf("could not retrieve user %s: %w", email, err)
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		return nil, fmt.Errorf("login failed: %w", err)
	}

	if user.RegistrationToken != "" {
		return nil, fmt.Errorf("user has not been confirmed")
	}

	return user, nil
}
