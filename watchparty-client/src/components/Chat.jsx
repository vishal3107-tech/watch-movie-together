import { useState, useEffect, useRef } from 'react';

export default function Chat({ socket, userName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Listen for regular chats
    socket.on('chat-message', (data) => {
      setMessages((prev) => [...prev, data]);
    });

    // Listen for "User Joined" alerts
    socket.on('system-message', (data) => {
      setMessages((prev) => [...prev, { type: 'system', text: data.text, time: data.time }]);
    });

    return () => {
      socket.off('chat-message');
      socket.off('system-message');
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (input.trim()) {
      const msgData = {
        type: 'user',
        text: input,
        sender: userName,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      socket.emit('chat-message', msgData);
      setMessages((prev) => [...prev, msgData]); // Add to own screen
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-800">
      <div className="p-4 bg-gray-800 border-b border-gray-700">
        <h3 className="font-bold text-white">Room Chat</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i}>
            {msg.type === 'system' ? (
              /* SYSTEM MESSAGE (e.g. User Joined) */
              <div className="flex justify-center my-2">
                <span className="text-xs text-gray-400 italic bg-gray-800/80 px-3 py-1 rounded-full shadow-sm border border-gray-700">
                  {msg.text}
                </span>
              </div>
            ) : (
              /* REGULAR CHAT MESSAGE */
              <div className={`flex flex-col ${msg.sender === userName ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-gray-500 mb-1 px-1">{msg.sender} • {msg.time}</span>
                <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${msg.sender === userName ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-700 text-white rounded-bl-none'}`}>
                  {msg.text}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 bg-gray-800 border-t border-gray-700 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-gray-900 border border-gray-700 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        />
        <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-bold transition-colors">
          Send
        </button>
      </form>
    </div>
  );
}