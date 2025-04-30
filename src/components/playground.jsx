import { Input } from "@/components/ui/input";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChatHeader } from "./ui/header";
import MessageComponent from "./ui/message-component";

import { useMessageHistory } from "@/hooks/useMessageHistory";

import { generateUUID } from "@/lib/utils";
import { LoadingDots } from "@/assets/icons";
import useWhisper from "@/hooks/useWhisper";
import { Mic } from "lucide-react";
import { APP_SETTINGS } from "@/config/app-settings";

const bank = process.env.NEXT_PUBLIC_BANK;

export function Playground({ sessionId, startNewChat }) {
  const bankInfo = APP_SETTINGS[bank] || APP_SETTINGS.sbi;
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const { getMessages, addMessage } = useMessageHistory(sessionId);

  const {
    isRecording,
    transcription,
    transcriptionLoading,
    startRecording,
    stopRecording,
  } = useWhisper();

  const messages = useMemo(
    () => (sessionId ? getMessages() : []),
    [sessionId, getMessages]
  );

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    const content = inputValue.trim();
    if (!content) return;

    if (!sessionId) {
      console.error("Session ID is null");
      return;
    }

    addMessage({
      id: generateUUID(),
      name: "User",
      output: content,
      time: new Date().toISOString(),
    });

    const message = {
      session_id: sessionId,
      user_input: content,
    };
    setLoading(true);
    setInputValue("");
    try {
      const myHeaders = new Headers();
      myHeaders.append("Content-Type", "application/json");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/chat/response`,
        {
          method: "POST",
          headers: myHeaders,
          body: JSON.stringify(message),
          redirect: "follow",
        }
      );
      const data = await response.json();
      addMessage({
        id: generateUUID(),
        name: "Assistant",
        output: data.response,
        time: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error sending message:", error);
      addMessage({
        id: generateUUID(),
        name: "Assistant",
        output: "Sorry, I'm having trouble processing your request",
        time: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setInputValue(transcription || "");
  }, [transcription]);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <ChatHeader sessionId={sessionId} startNewChat={startNewChat} />
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-4">
          {messages.map((message) => (
            <MessageComponent key={message.id} message={message} />
          ))}
          {loading && (
            <div className="flex justify-start w-24">
              <LoadingDots />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="border-t p-4 bg-white sticky bottom-0">
        <div className="flex items-center justify-center space-x-2">
          <button
            style={{
              backgroundColor: isRecording ? "red" : bankInfo.primaryColor,
            }}
            className={`p-2 rounded-full text-white mx-2 hidden lg:block`}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
          >
            {!isRecording ? <Mic /> : <Mic className="bg-red-500" />}
          </button>
          <button
            style={{
              backgroundColor: isRecording ? "red" : bankInfo.primaryColor,
            }}
            className={`p-2 rounded-full text-white mx-2 lg:hidden block`}
            onClick={() => {
              if (isRecording) {
                stopRecording();
              } else {
                startRecording();
              }
            }}
          >
            {!isRecording ? <Mic /> : <Mic className="bg-red-500" />}
          </button>
          {transcriptionLoading ? (
            <div className="flex items-center justify-center w-full">
              <LoadingDots className="w-12 h-12" />
            </div>
          ) : isRecording ? (
            <div className="flex-1 ring-0 focus:ring-0 text-rose-500">
              recording...
            </div>
          ) : (
            <Input
              autoFocus
              disabled={loading}
              className="flex-1 ring-0 focus:ring-0"
              id="message-input"
              placeholder="Type a message"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyUp={(e) => {
                if (e.key === "Enter") {
                  handleSendMessage();
                }
              }}
            />
          )}

          <button
            style={{
              backgroundColor: bankInfo.primaryColor,
            }}
            className="px-4 py-2 rounded-md text-white"
            onClick={handleSendMessage}
            type="submit"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
