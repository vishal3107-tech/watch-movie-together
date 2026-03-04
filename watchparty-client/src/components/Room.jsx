import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import Chat from './Chat';
import VideoPlayer from './VideoPlayer';
import VideoGrid from './VideoGrid';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://YOUR-RENDER-URL.onrender.com';
const socket = io(SERVER_URL); 

export default function Room() {
  const { roomId } = useParams();
  const [externalVideoUrl, setExternalVideoUrl] = useState('');
  const [userName, setUserName] = useState('');
  const [isJoined, setIsJoined] = useState(false);

  // --- FULL SCREEN LOGIC ---
  const roomContainerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      roomContainerRef.current?.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen();
    }
  };
  // -------------------------

  if (!isJoined) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white font-sans p-4">
        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md flex flex-col gap-6 text-center">
          <h2 className="text-2xl font-bold text-blue-400">Join Room: {roomId}</h2>
          <p className="text-gray-400 text-sm">Please enter your name to continue.</p>
          <form onSubmit={(e) => { e.preventDefault(); if (userName.trim()) setIsJoined(true); }} className="flex flex-col gap-4">
            <input
              type="text" placeholder="Your Name" value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full bg-black/50 border border-gray-600 rounded-lg px-4 py-3 text-lg focus:outline-none focus:border-blue-500 text-white"
              autoFocus required
            />
            <button type="submit" disabled={!userName.trim()} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-all">
              Enter Watch Party
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    // We attach the ref here so the entire screen, including chat, goes full screen!
    <div ref={roomContainerRef} className="flex h-screen overflow-hidden bg-gray-900 text-white font-sans relative">
      
      {/* MAIN VIDEO AREA */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all ${isFullscreen ? 'p-0' : 'p-4'}`}>
        
        {/* HEADER (Hidden in Full Screen) */}
        {!isFullscreen && (
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold tracking-tight">Room: <span className="text-blue-400">{roomId}</span></h2>
            <div className="flex gap-4 items-center">
              <div className="text-sm bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
                Playing as: <span className="text-green-400 font-bold">{userName}</span>
              </div>
              <button onClick={toggleFullscreen} className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg text-sm font-bold shadow-lg transition-all active:scale-95">
                ⛶ Full Screen
              </button>
            </div>
          </div>
        )}
        
        {/* VIDEO PLAYER */}
        <div className={`flex-1 bg-black flex items-center justify-center overflow-hidden min-h-0 ${isFullscreen ? 'rounded-none border-none z-0' : 'rounded-xl border border-gray-700 mb-4 shadow-2xl'}`}>
          <VideoPlayer socket={socket} externalUrl={externalVideoUrl} />
        </div>

        {/* WEBCAM GRID (Hidden in Full Screen) */}
        {!isFullscreen && (
          <div className="h-48 bg-gray-800/50 rounded-xl border border-gray-700 flex items-center overflow-hidden">
            <VideoGrid socket={socket} roomId={roomId} setExternalVideoUrl={setExternalVideoUrl} userName={userName} />
          </div>
        )}
      </div>

      {/* CHAT SECTION (Transforms into overlay during Full Screen) */}
      <div className={`transition-all duration-300 ease-in-out ${
          isFullscreen
            ? `absolute top-0 right-0 h-full w-80 z-50 border-l border-white/10 backdrop-blur-md 
               /* 👇 CHANGE TRANSPARENCY HERE 👇 */
               /* 'bg-black/40' = 40% solid. Use 'bg-black/10' for high transparency, 'bg-black/80' for dark */
               bg-black/40` 
            : 'w-80 border-l border-gray-800 bg-gray-900/50 relative'
        }`}
      >
        {/* Exit Full Screen Button (Shows on edge of chat) */}
        {isFullscreen && (
          <button onClick={toggleFullscreen} className="absolute top-4 left-[-40px] bg-black/60 p-2 rounded-l-lg hover:bg-red-600 transition-colors z-50 text-white shadow-lg" title="Exit Full Screen">
            ✖
          </button>
        )}
        <Chat socket={socket} userName={userName} />
      </div>
    </div>
  );
}