import { useState } from "react";

const useSession = () => {
  const [sessionId, setSessionId] = useState(null);

  const createSession = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/session/create`,
        {
          method: "POST",
          redirect: "follow",
        }
      );
      const data = await response.json();
      setSessionId(data.session_id);
    } catch (error) {
      console.error("Error creating session:", error);
    }
  };

  const destroySession = async () => {
    if (!sessionId) {
      console.error("No session to destroy");
      return;
    }
    try {
      const myHeaders = new Headers();
      myHeaders.append("Content-Type", "application/json");

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/session/terminate`,
        {
          method: "POST",
          headers: myHeaders,
          body: JSON.stringify({ session_id: sessionId }),
          redirect: "follow",
        }
      );
      setSessionId(null);
      console.log("Session terminated:", response);
    } catch (error) {
      console.error("Error terminating session:", error);
    }
  };

  const startNewChat = async () => {
    await destroySession();
    await createSession();
  };

  return {
    sessionId,
    createSession,
    destroySession,
    startNewChat,
  };
};

export default useSession;
