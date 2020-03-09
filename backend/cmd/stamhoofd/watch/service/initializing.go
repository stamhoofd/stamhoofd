package service

type initializing struct {
	*service
}

func Initializing(service *service) *initializing {
	return &initializing{
		service: service,
	}
}

func (s *initializing) Wait() {
}

func (s *initializing) Consume(action interface{}) State {
	switch action.(type) {
	case Nothing:
		return Starting(s)
	case Stop:
		return Stopped(s, nil)
	case End:
		return Ended(Stopped(s, nil))
	default:
		return InvalidAction(s, action)
	}
}
