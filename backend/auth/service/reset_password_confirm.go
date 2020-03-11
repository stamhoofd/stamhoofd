package service

import (
	"errors"
	"fmt"

	"github.com/jinzhu/gorm"
	"github.com/sirupsen/logrus"
	"github.com/stamhoofd/stamhoofd/backend/auth/models"
	"golang.org/x/crypto/bcrypt"
)

func ResetPasswordConfirm(db *gorm.DB, email, token, password string) (*models.User, error) {
	user := &models.User{}
	err := db.Where(&models.User{
		Email: email,
	}).First(user).Error
	if err != nil {
		return nil, fmt.Errorf("could not retrieve user %s: %w", email, err)
	}

	passwordReset := &models.PasswordReset{}
	result := db.Find(&models.PasswordReset{
		UserID: user.ID,
		Token:  token,
	}).Delete(passwordReset)
	if result.Error != nil {
		return nil, fmt.Errorf("could not reset password: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return nil, errors.New("password reset was not deleted")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	err = db.Model(user).Update("password", string(hashedPassword)).Error
	if err != nil {
		return nil, fmt.Errorf("could not update password for user %v: %w", user, err)
	}
	logrus.Infof("resetted password for user: %v", user)
	return user, nil
}
