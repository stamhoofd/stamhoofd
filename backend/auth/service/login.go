package service

import (
	"fmt"

	"github.com/jinzhu/gorm"
	"github.com/sirupsen/logrus"
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

	err = db.Model(user).Update("registration_token", nil).Error
	if err != nil {
		return nil, fmt.Errorf("could not update registration token for user %s: %w", email, err)
	}

	logrus.Infof("confirmed user registration: %v", user)
	return user, nil
}
