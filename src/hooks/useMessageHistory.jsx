import { useState } from "react";

const useMessageHistory = (sessionId) => {
  const [messageHistory, setMessageHistory] = useState({});

  const addMessage = (content) => {
    if (sessionId) {
      setMessageHistory((prevHistory) => ({
        ...prevHistory,
        [sessionId]: [...(prevHistory[sessionId] || []), content],
      }));
    }
  };

  const getMessages = () => {
    return sessionId ? messageHistory[sessionId] || [] : [];
  };

  return {
    getMessages,
    addMessage,
  };
};

export { useMessageHistory };
