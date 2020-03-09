package service

type stopped struct {
	*service
	err error
}

func Stopped(state State, err error) *stopped {
	return &stopped{
		service: state.Service(),
		err:     err,
	}
}
func (s *stopped) Wait() {
	if s.err != nil {
		s.logger.Error(s.err)
		s.err = nil
	}
}

func (s *stopped) Consume(action interface{}) State {
	switch action.(type) {
	case Nothing:
		return s
	case Start, Restart:
		return Starting(s)
	case End:
		return Ended(s)
	default:
		return InvalidAction(s, action)
	}
}
