package service

import "time"

type starting struct {
	*service
}

func Starting(state State) *starting {
	return &starting{
		service: state.Service(),
	}
}

func (s *starting) Wait() {
	time.Sleep(time.Millisecond * 100)
}

func (s *starting) Consume(action interface{}) State {
	switch action.(type) {
	case Nothing:
		if s.HasRunCommand() {
			if s.HasDependencies() {
				return Dependencies(s)
			}
			return Running(s)
		}
		s.logger.Debug("Changing to Installing!")
		return Installing(s)
	default:
		return InvalidAction(s, action)
	}
}
