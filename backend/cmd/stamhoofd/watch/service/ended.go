package service

type ended struct {
	*stopped
}

func Ended(state *stopped) *ended {
	return &ended{
		stopped: state,
	}
}
