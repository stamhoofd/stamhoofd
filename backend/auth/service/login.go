package service

import (
	"fmt"

	"github.com/jinzhu/gorm"
	"github.com/sirupsen/logrus"
	"github.com/stamhoofd/stamhoofd/backend/auth/models"
	"golang.org/x/crypto/bcrypt"
)

func Login(db *gorm.DB, email, password string) (*models.LoggedInResponse, error) {
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

	return saveLogin(db, user)
}

func saveLogin(db *gorm.DB, user *models.User) (*models.LoggedInResponse, error) {
	token, err := GenerateToken()
	if err != nil {
		return nil, err
	}

	user.RegistrationToken = ""
	user.AuthenticationToken = token
	err = db.Model(user).Update(user).Error
	if err != nil {
		return nil, fmt.Errorf("could not update registration token for user %v: %w", user, err)
	}

	logrus.Infof("logged user in: %v", user)
	return &models.LoggedInResponse{
		User:  *user,
		Token: token,
	}, nil
}
