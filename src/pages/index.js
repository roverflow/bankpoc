import { useEffect } from "react";

import { Playground } from "@/components/playground";
import useSession from "@/hooks/useSession";

function Home() {
  const { sessionId, startNewChat, createSession } = useSession();

  useEffect(() => {
    createSession();
  }, []);

  return (
    <>
      <Playground sessionId={sessionId} startNewChat={startNewChat} />
    </>
  );
}

export default Home;
