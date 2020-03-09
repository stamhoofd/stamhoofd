package models

type PermissionType int

const (
	// Invite members to a group.
	InviteMembers PermissionType = 0

	// View members basic info (not CareInfo).
	ViewMembers PermissionType = 1

	// View more advanced info of a member (CareInfo).
	ViewMembersCareInfo PermissionType = 2

	// Allow the member to create a group. Only allowed on a permission without a group.
	CreateGroup PermissionType = 3

	// Edit the basic info of a member.
	EditMembers PermissionType = 4

	// Move members to another group where you have the InviteMembers permission.
	MoveMembers PermissionType = 5

	// Remove members from a group.
	RemoveMembers PermissionType = 6
)
