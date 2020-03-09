package service

import "fmt"

type invalid struct {
	*service
	err error
}

func Invalid(state State, err error) *invalid {
	return &invalid{
		service: state.Service(),
		err:     err,
	}
}

func InvalidAction(state State, action interface{}) *invalid {
	return Invalid(
		state,
		fmt.Errorf("Invalid action %T received by %T", action, state),
	)
}

func (s *invalid) Consume(action interface{}) State {
	return s
}

func (s *invalid) Wait() {
	s.logger.Error(s.err)
}
