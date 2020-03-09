package models

type Permission struct {
	Model

	// Group that this permission has access to.
	Group *Group
	Type  PermissionType
}
