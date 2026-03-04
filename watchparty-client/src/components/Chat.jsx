import { useState, useEffect, useRef } from 'react';

export default function Chat({ socket, userName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    socket.on('chat-message', (data) => setMessages((prev) => [...prev, data]));
    socket.on('system-message', (data) => setMessages((prev) => [...prev, { type: 'system', text: data.text, time: data.time }]));
    
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
        type: 'user', text: input, sender: userName,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      socket.emit('chat-message', msgData);
      setMessages((prev) => [...prev, msgData]); 
      setInput('');
    }
  };

  return (
    // Replaced solid bg-gray-900 with bg-transparent so the Room's transparency shows through
    <div className="flex flex-col h-full bg-transparent">
      
      <div className="p-4 bg-black/20 border-b border-white/10 backdrop-blur-sm">
        <h3 className="font-bold text-white drop-shadow-md">Room Chat</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i}>
            {msg.type === 'system' ? (
              <div className="flex justify-center my-2">
                <span className="text-xs text-gray-300 italic bg-black/40 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
                  {msg.text}
                </span>
              </div>
            ) : (
              <div className={`flex flex-col ${msg.sender === userName ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-gray-400 mb-1 px-1 drop-shadow-md">{msg.sender} • {msg.time}</span>
                <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm shadow-lg ${msg.sender === userName ? 'bg-blue-600/90 text-white rounded-br-none backdrop-blur-sm' : 'bg-gray-700/80 text-white rounded-bl-none backdrop-blur-sm'}`}>
                  {msg.text}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 bg-black/20 border-t border-white/10 flex gap-2 backdrop-blur-sm">
        <input
          type="text" value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-black/40 border border-gray-600 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-gray-400"
        />
        <button type="submit" className="bg-blue-600/90 hover:bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-bold transition-colors shadow-lg">
          Send
        </button>
      </form>
    </div>
  );
}