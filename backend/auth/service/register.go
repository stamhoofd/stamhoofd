package service

import (
	"math/rand"

	"github.com/jinzhu/gorm"
	"github.com/sirupsen/logrus"
	"github.com/stamhoofd/stamhoofd/backend/auth/models"
	"golang.org/x/crypto/bcrypt"
)

const symbols = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

func generateToken(length int) string {
	token := make([]byte, length)
	for i := range token {
		token[i] = symbols[rand.Intn(len(symbols))]
	}
	return string(token)
}

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

	user := &models.User{
		Email:             email,
		Password:          string(hashedPassword),
		RegistrationToken: generateToken(128),
	}
	db.Create(user)

	logrus.Infof("saved user to database: %v", user)
	return user, nil
}
