package binding

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	goaudio "github.com/go-audio/audio"
	"github.com/go-audio/wav"
)

// createTestWAV creates a minimal WAV file for testing
func createTestWAV(t *testing.T, dir string, name string, sampleRate int, numChans int, bitDepth int) string {
	t.Helper()
	path := filepath.Join(dir, name)
	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("failed to create test WAV: %v", err)
	}
	defer f.Close()

	enc := wav.NewEncoder(f, sampleRate, bitDepth, numChans, 1) // audioFormat=1 (PCM)
	// Write a few samples
	buf := &goaudio.IntBuffer{
		Data:           make([]int, sampleRate*numChans), // 1 second of silence
		Format:         &goaudio.Format{SampleRate: sampleRate, NumChannels: numChans},
		SourceBitDepth: bitDepth,
	}
	if err := enc.Write(buf); err != nil {
		t.Fatalf("failed to write WAV data: %v", err)
	}
	if err := enc.Close(); err != nil {
		t.Fatalf("failed to close WAV encoder: %v", err)
	}
	return path
}

func TestValidateWAVFormat_Valid8kHzMono(t *testing.T) {
	dir := t.TempDir()
	path := createTestWAV(t, dir, "valid.wav", 8000, 1, 16)

	result := validateWAVFormat(path)
	if !result.Valid {
		t.Errorf("expected Valid=true, got error: %s", result.Error)
	}
	if result.Details == "" {
		t.Error("expected non-empty Details for valid WAV")
	}
}

func TestValidateWAVFormat_FileNotFound(t *testing.T) {
	result := validateWAVFormat("/nonexistent/path/test.wav")
	if result.Valid {
		t.Error("expected Valid=false for non-existent file")
	}
	if result.Error == "" {
		t.Error("expected non-empty Error")
	}
}

func TestValidateWAVFormat_NotWAV(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "not-wav.wav")
	os.WriteFile(path, []byte("this is not a wav file"), 0644)

	result := validateWAVFormat(path)
	if result.Valid {
		t.Error("expected Valid=false for non-WAV file")
	}
}

func TestValidateWAVFormat_Wrong_SampleRate(t *testing.T) {
	dir := t.TempDir()
	path := createTestWAV(t, dir, "44100hz.wav", 44100, 1, 16)

	result := validateWAVFormat(path)
	if result.Valid {
		t.Error("expected Valid=false for 44.1kHz WAV")
	}
	if result.Error == "" || !strings.Contains(result.Error, "8kHz") {
		t.Errorf("expected error mentioning 8kHz, got: %s", result.Error)
	}
}

func TestValidateWAVFormat_Stereo(t *testing.T) {
	dir := t.TempDir()
	path := createTestWAV(t, dir, "stereo.wav", 8000, 2, 16)

	result := validateWAVFormat(path)
	if result.Valid {
		t.Error("expected Valid=false for stereo WAV")
	}
	if result.Error == "" || !strings.Contains(result.Error, "mono") {
		t.Errorf("expected error mentioning mono, got: %s", result.Error)
	}
}
