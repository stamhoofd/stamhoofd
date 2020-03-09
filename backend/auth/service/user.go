package service

import (
	"github.com/google/uuid"
	"github.com/jinzhu/gorm"
	"github.com/stamhoofd/stamhoofd/backend/auth/models"
)

func FindUserByID(db *gorm.DB, raw_id string) (*models.User, error) {
	id, err := uuid.Parse(raw_id)
	if err != nil {
		return nil, err
	}

	user := &models.User{}
	err = db.Where(&models.User{
		Model: models.Model{
			ID: id,
		},
	}).First(user).Error
	return user, err
}
