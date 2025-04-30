import { useState, useRef, useEffect, useCallback } from "react";

const apiEndpoint = "/api/transcribe";

// Audio configuration for better quality
const DEFAULT_AUDIO_CONFIG = {
  sampleRate: 44100,
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

const useWhisper = (options = {}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState(null);
  const [transcriptionLoading, setTranscriptionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState(null); // Added to track permission status

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  // Audio settings with user overrides
  const audioConfig = {
    ...DEFAULT_AUDIO_CONFIG,
    ...options.audioConfig,
  };

  // Clean up function for media resources
  const cleanupMedia = useCallback(() => {
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach((track) => track.stop());
      streamRef.current = null;
    }

    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupMedia();
    };
  }, [cleanupMedia]);

  const checkAudioSupport = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Your browser doesn't support audio recording");
      return false;
    }

    if (!window.MediaRecorder) {
      setError("MediaRecorder API not supported in your browser");
      return false;
    }

    return true;
  };

  // Function to check microphone permission status
  const checkMicPermission = useCallback(async () => {
    try {
      // Check if Permission API is supported
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({
          name: "microphone",
        });
        setPermissionStatus(result.state);

        // Set up listener for permission changes
        result.onchange = function () {
          setPermissionStatus(this.state);
        };

        return result.state;
      } else {
        // Fallback for browsers that don't support Permission API
        return "unknown";
      }
    } catch (error) {
      console.error("Error checking microphone permission:", error);
      return "unknown";
    }
  }, []);

  // Request microphone permission explicitly
  const requestMicPermission = useCallback(async () => {
    try {
      // Check browser support first
      if (!checkAudioSupport()) return false;

      setError(null);

      // This will trigger the permission dialog if permission hasn't been granted yet
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Stop the stream immediately since we're just requesting permission
      stream.getTracks().forEach((track) => track.stop());

      // Update permission status
      await checkMicPermission();

      return true;
    } catch (error) {
      console.error("Permission request failed:", error);
      setError(`Microphone permission denied: ${error.message}`);
      await checkMicPermission();
      return false;
    }
  }, [checkMicPermission]);

  // Check permission on component mount
  useEffect(() => {
    checkMicPermission();
  }, [checkMicPermission]);

  const startRecording = async () => {
    try {
      setError(null);

      // Check for browser support
      if (!checkAudioSupport()) return;

      // Check microphone permission first
      const permissionState = await checkMicPermission();

      if (permissionState === "denied") {
        setError(
          "Microphone permission has been denied. Please enable it in your browser settings."
        );
        return;
      }

      // If permission is prompt or unknown, request permission explicitly
      if (permissionState === "prompt" || permissionState === "unknown") {
        const permissionGranted = await requestMicPermission();
        if (!permissionGranted) {
          // User denied permission or there was an error
          return;
        }

        // Exit after gaining permission - subsequent calls will work
        setError("Microphone permission granted. Please try recording again.");
        return;
      }

      // Reset state if any previous recordings exist
      cleanupMedia();
      audioChunksRef.current = [];

      console.log("Starting audio recording with config:", audioConfig);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConfig,
      });

      streamRef.current = stream;

      // Create analyzer to check audio levels
      const audioContext = new AudioContext();
      const audioSource = audioContext.createMediaStreamSource(stream);
      const analyzer = audioContext.createAnalyser();
      audioSource.connect(analyzer);

      // Test for audio signal
      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Small timeout to let the mic initialize
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Create media recorder with specified mime type and bitrate
      const options = {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 128000,
      };

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      // Listen for data
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);

          // Check audio levels periodically
          analyzer.getByteFrequencyData(dataArray);
          const average =
            dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
          console.log("Current audio level:", average);
        }
      };

      // Set up recording completion handler
      mediaRecorder.onstop = async () => {
        if (
          audioChunksRef.current.length === 0 ||
          !audioChunksRef.current.some((chunk) => chunk.size > 0)
        ) {
          setError("No audio data was recorded");
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        // Quick validation of the blob
        if (audioBlob.size < 1000) {
          setError("Recording too short or empty");
          return;
        }

        try {
          setTranscriptionLoading(true);

          const formData = new FormData();
          formData.append("audioblob", audioBlob, "recording.webm");
          formData.append("ai", "any");

          const response = await fetch(apiEndpoint, {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            throw new Error(
              `Server responded with ${response.status}: ${response.statusText}`
            );
          }

          const data = await response.json();
          setTranscription(data.text);
          console.log("Audio processed successfully");
        } catch (error) {
          console.error("Error processing audio:", error);
          setError(`Failed to process audio: ${error.message}`);
        } finally {
          setTranscriptionLoading(false);
          audioContext.close();
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        setError(`Recording error: ${event.error.name}`);
        cleanupMedia();
      };

      // Start recording with small time slices to get frequent updates
      mediaRecorder.start(1000);
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
      setError(`Could not start recording: ${error.message}`);
      cleanupMedia();
    }
  };

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        console.log("Recording stopped");
      } catch (error) {
        console.error("Error stopping recording:", error);
        setError(`Error stopping recording: ${error.message}`);
        cleanupMedia();
      }
    }
  }, [cleanupMedia]);

  // Force stop recording after maximum duration
  useEffect(() => {
    let timeout;
    if (isRecording && options.maxDurationMs) {
      timeout = setTimeout(() => {
        console.log(
          `Max recording duration (${options.maxDurationMs}ms) reached`
        );
        stopRecording();
      }, options.maxDurationMs);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isRecording, options.maxDurationMs, stopRecording]);

  return {
    isRecording,
    transcriptionLoading,
    transcription,
    error,
    permissionStatus,
    startRecording,
    stopRecording,
    requestMicPermission,
    resetTranscription: () => setTranscription(null),
    resetError: () => setError(null),
  };
};

export default useWhisper;
