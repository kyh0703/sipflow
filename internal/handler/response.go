package handler

// Response is a generic wrapper for all handler responses
type Response[T any] struct {
	Success bool   `json:"success"`
	Data    T      `json:"data,omitempty"`
	Error   *Error `json:"error,omitempty"`
}

// Error represents an error response
type Error struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Success creates a successful response with data
func Success[T any](data T) Response[T] {
	return Response[T]{
		Success: true,
		Data:    data,
	}
}

// Failure creates an error response
func Failure[T any](code, message string) Response[T] {
	return Response[T]{
		Success: false,
		Error: &Error{
			Code:    code,
			Message: message,
		},
	}
}
