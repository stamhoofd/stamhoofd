package service

type State interface {
	// These are defaults set on *service.
	Service() *service
	DefaultAction() interface{}

	Consume(action interface{}) State
	Wait()
}

type Start struct{}
type Nothing struct{}
type Install struct{}
type Stop struct{}
type End struct{}
type Restart struct{}
