import { useState, useRef } from "react";

const apiEndpoint = "/api/transcribe";

const useWhisper = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState(null);
  const [transcriptionLoading, setTranscriptionLoading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error("Media devices not supported");
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
      audioChunksRef.current = [];

      const formData = new FormData();
      formData.append("audioblob", audioBlob, "recording.wav");
      formData.append("ai", "any");

      try {
        setTranscriptionLoading(true);
        const response = await fetch(apiEndpoint, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        setTranscription(data.text);
        console.log("Audio sent successfully");
      } catch (error) {
        console.error("Error sending audio:", error);
      } finally {
        setTranscriptionLoading(false);
      }
    };

    mediaRecorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return {
    isRecording,
    transcriptionLoading,
    transcription,
    startRecording,
    stopRecording,
  };
};

export default useWhisper;
