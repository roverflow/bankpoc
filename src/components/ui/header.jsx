import Image from "next/image";
import { APP_SETTINGS } from "@/config/app-settings";

const bank = process.env.NEXT_PUBLIC_BANK;

function ChatHeader({ sessionId, startNewChat }) {
  console.log(sessionId);
  const bankInfo = APP_SETTINGS[bank] || APP_SETTINGS.sbi;
  return (
    <header className="flex sticky top-0 bg-background py-1.5 items-center justify-between px-2 md:px-2 gap-2 border-b">
      <div className="flex items-center gap-2">
        <Image src={bankInfo.logo} alt="SBI Life" height={50} />
        {/* <div className="text-lg flex flex-col font-bold text-black">
          <span>{bankInfo.title}</span>
        </div> */}
      </div>
      <button
        onClick={startNewChat}
        style={{
          color: bankInfo.primaryColor,
          borderColor: bankInfo.primaryColor,
        }}
        className={`border bg-white px-4 py-2 rounded-md`}
      >
        + New Chat
      </button>
    </header>
  );
}

export { ChatHeader };
