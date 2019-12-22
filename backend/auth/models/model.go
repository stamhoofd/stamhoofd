package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/jinzhu/gorm"
)

// TODO Move me to some shared library perhaps?
type Model struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt *time.Time
}

// BeforeCreate sets the UUID automatically.
func (model *Model) BeforeCreate(scope *gorm.Scope) error {
	uuid, err := uuid.NewRandom()
	if err != nil {
		return err
	}
	return scope.SetColumn("ID", uuid)
}
