import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import Chat from './Chat';
import VideoPlayer from './VideoPlayer';
import VideoGrid from './VideoGrid';

// CRITICAL: Make sure this is your LIVE Render URL, not localhost!
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://YOUR-RENDER-URL.onrender.com';
const socket = io(SERVER_URL); 

export default function Room() {
  const { roomId } = useParams();
  const [externalVideoUrl, setExternalVideoUrl] = useState('');
  
  // New States for the Name Prompt
  const [userName, setUserName] = useState('');
  const [isJoined, setIsJoined] = useState(false);

  // The Name Entry Screen
  if (!isJoined) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white font-sans p-4">
        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md flex flex-col gap-6 text-center">
          <h2 className="text-2xl font-bold text-blue-400">Join Room: {roomId}</h2>
          <p className="text-gray-400 text-sm">Please enter your name to continue.</p>
          <form 
            onSubmit={(e) => { e.preventDefault(); if (userName.trim()) setIsJoined(true); }} 
            className="flex flex-col gap-4"
          >
            <input
              type="text"
              placeholder="Your Name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full bg-black/50 border border-gray-600 rounded-lg px-4 py-3 text-lg focus:outline-none focus:border-blue-500 text-white"
              autoFocus
              required
            />
            <button
              type="submit"
              disabled={!userName.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-all"
            >
              Enter Watch Party
            </button>
          </form>
        </div>
      </div>
    );
  }

  // The Actual Room (Renders only after joining)
  return (
    <div className="flex h-screen overflow-hidden bg-gray-900 text-white font-sans">
      <div className="flex-1 flex flex-col p-4 min-w-0">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold tracking-tight">Room: <span className="text-blue-400">{roomId}</span></h2>
          <div className="text-sm bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
            Playing as: <span className="text-green-400 font-bold">{userName}</span>
          </div>
        </div>
        
        <div className="flex-1 rounded-xl border border-gray-700 bg-black flex items-center justify-center overflow-hidden mb-4 shadow-2xl min-h-0">
          <VideoPlayer socket={socket} externalUrl={externalVideoUrl} />
        </div>

        <div className="h-48 bg-gray-800/50 rounded-xl border border-gray-700 flex items-center overflow-hidden">
          <VideoGrid 
            socket={socket} 
            roomId={roomId} 
            setExternalVideoUrl={setExternalVideoUrl} 
            userName={userName} // Passing the name down
          />
        </div>
      </div>

      <div className="w-80 border-l border-gray-800 bg-gray-900/50">
        <Chat socket={socket} userName={userName} />
      </div>
    </div>
  );
}