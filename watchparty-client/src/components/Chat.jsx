import { useState, useEffect, useRef } from 'react';

export default function Chat({ socket }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Listen for incoming messages from the server
    socket.on('chat-message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.off('chat-message');
    };
  }, [socket]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (input.trim() === '') return;

    socket.emit('send-chat-message', { text: input });
    setInput('');
  };

  return (
    <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col h-full">
      <div className="p-4 border-b border-gray-700 font-bold text-lg">
        Room Chat
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
        {messages.map((msg, index) => (
          <div key={index} className={`max-w-[90%] p-2 rounded-lg ${msg.senderId === socket.id ? 'bg-blue-600 self-end' : 'bg-gray-700 self-start'}`}>
            <p className="text-xs text-gray-300 mb-1">
              {msg.senderId === socket.id ? 'You' : msg.senderId.slice(0, 5)}
            </p>
            <p className="text-sm">{msg.text}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t border-gray-700 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-gray-900 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button type="submit" className="bg-blue-600 px-4 py-2 rounded text-sm hover:bg-blue-700">
          Send
        </button>
      </form>
    </div>
  );
}