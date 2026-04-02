import type { Message } from "./types";

export function sendMessage(message: Message): Promise<Message> {
  return chrome.runtime.sendMessage(message);
}

export function onMessage(
  handler: (
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: Message) => void
  ) => boolean | void
) {
  chrome.runtime.onMessage.addListener(handler);
}
