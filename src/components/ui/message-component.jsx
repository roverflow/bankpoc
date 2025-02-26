import Markdown from "marked-react";

const MessageComponent = ({ message }) => {
  const dateOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };
  const date = new Date(message.time).toLocaleTimeString(
    undefined,
    dateOptions
  );
  const isAi = message.name === "Assistant";
  return (
    <>
      <div
        key={message.id}
        className={`flex ${isAi ? "justify-start" : "justify-end"} gap-2`}
      >
        {/* {isAi && (
          <div className="w-20 text-sm text-blue-500">{message.name}</div>
        )} */}
        <div
          className={`border rounded-lg px-4 py-2 bg-white ${
            isAi ? "border-[#0091EA]" : "border-[#4CAF50]"
          }`}
        >
          <Markdown>{message.output}</Markdown>
          <small className="text-xs text-gray-500">{date}</small>
        </div>
        {/* {!isAi && (
          <div className="text-sm text-green-500 ml-4 capitalize">
            {message.name}
          </div>
        )} */}
      </div>
    </>
  );
};

export default MessageComponent;
