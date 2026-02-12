package binding

import (
	"context"
	"fmt"
	"os"

	"github.com/go-audio/wav"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// MediaBinding provides frontend bindings for media operations
type MediaBinding struct {
	ctx context.Context
}

// NewMediaBinding creates a new MediaBinding instance
func NewMediaBinding() *MediaBinding {
	return &MediaBinding{}
}

// SetContext sets the Wails runtime context
func (m *MediaBinding) SetContext(ctx context.Context) {
	m.ctx = ctx
}

// WAVValidationResult represents the result of WAV file validation
type WAVValidationResult struct {
	Valid   bool   `json:"valid"`
	Error   string `json:"error,omitempty"`
	Details string `json:"details,omitempty"`
}

// ValidateWAVFile validates WAV file format for 8kHz mono PCM
func (m *MediaBinding) ValidateWAVFile(filePath string) (*WAVValidationResult, error) {
	runtime.LogInfo(m.ctx, fmt.Sprintf("Validating WAV: %s", filePath))

	f, err := os.Open(filePath)
	if err != nil {
		return &WAVValidationResult{
			Valid: false,
			Error: fmt.Sprintf("Cannot open file: %v", err),
		}, nil
	}
	defer f.Close()

	decoder := wav.NewDecoder(f)
	if !decoder.IsValidFile() {
		return &WAVValidationResult{
			Valid: false,
			Error: "Not a valid WAV file",
		}, nil
	}

	// ReadInfo populates decoder fields (doesn't return error)
	decoder.ReadInfo()

	// Validate 8kHz mono PCM
	if decoder.SampleRate != 8000 {
		return &WAVValidationResult{
			Valid: false,
			Error: fmt.Sprintf("Sample rate must be 8kHz (file is %d Hz)", decoder.SampleRate),
		}, nil
	}

	if decoder.NumChans != 1 {
		return &WAVValidationResult{
			Valid: false,
			Error: fmt.Sprintf("Must be mono (file has %d channels)", decoder.NumChans),
		}, nil
	}

	// PCM format is 1 in WAV spec (WavAudioFormat field)
	if decoder.WavAudioFormat != 1 {
		return &WAVValidationResult{
			Valid: false,
			Error: "Audio format must be PCM",
		}, nil
	}

	runtime.LogInfo(m.ctx, "WAV validation passed")
	return &WAVValidationResult{
		Valid:   true,
		Details: fmt.Sprintf("8kHz mono PCM, %d-bit", decoder.BitDepth),
	}, nil
}

// SelectWAVFile opens file dialog and validates selection
func (m *MediaBinding) SelectWAVFile() (string, error) {
	runtime.LogInfo(m.ctx, "Opening WAV file dialog")

	selected, err := runtime.OpenFileDialog(m.ctx, runtime.OpenDialogOptions{
		Title: "Select WAV Audio File",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "WAV Audio (*.wav)",
				Pattern:     "*.wav",
			},
		},
	})

	if err != nil {
		runtime.LogError(m.ctx, fmt.Sprintf("File dialog error: %v", err))
		return "", err
	}

	if selected == "" {
		// User cancelled
		return "", nil
	}

	// Validate immediately
	result, err := m.ValidateWAVFile(selected)
	if err != nil {
		return "", err
	}

	if !result.Valid {
		runtime.LogWarning(m.ctx, fmt.Sprintf("WAV validation failed: %s", result.Error))
		return "", fmt.Errorf("%s", result.Error)
	}

	runtime.LogInfo(m.ctx, fmt.Sprintf("Selected valid WAV: %s", selected))
	return selected, nil
}
