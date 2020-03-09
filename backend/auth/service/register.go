package service

import (
	"github.com/jinzhu/gorm"
	"github.com/sirupsen/logrus"
	"github.com/stamhoofd/stamhoofd/backend/auth/models"
	"golang.org/x/crypto/bcrypt"
)

func Register(db *gorm.DB, email, password string) (*models.User, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// err = SendEmail(email, "Welcome to Stamhoofd!",
	// 	"This is the welcome body!")
	// if err != nil {
	// 	logrus.Error("Failed to send register email: %+v", err)
	// 	return nil, err
	// }
	// logrus.Info("email sent to %s", email)

	token, err := GenerateToken()
	if err != nil {
		return nil, err
	}

	user := &models.User{
		Email:             email,
		Password:          string(hashedPassword),
		RegistrationToken: token,
	}
	err = db.Create(user).Error
	if err != nil {
		return nil, err
	}

	logrus.Infof("saved user to database: %v", user)
	return user, nil
}
