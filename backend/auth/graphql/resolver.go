package graphql

import (
	"github.com/jinzhu/gorm"
)

type Resolver struct {
	DB *gorm.DB
}

func (r *Resolver) Mutation() MutationResolver {
	return &mutationResolver{r}
}
func (r *Resolver) Query() QueryResolver {
	return &queryResolver{r}
}
func (r *Resolver) Entity() EntityResolver {
	return &entityResolver{r}
}
