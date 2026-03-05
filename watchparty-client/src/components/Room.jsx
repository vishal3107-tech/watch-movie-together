import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Chat from './Chat';
import VideoPlayer from './VideoPlayer';
import VideoGrid from './VideoGrid';
import { socket } from '../socket'; 

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [externalVideoUrl, setExternalVideoUrl] = useState('');
  const [userName, setUserName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [copied, setCopied] = useState(false); // Copy state

  const roomContainerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) roomContainerRef.current?.requestFullscreen().catch(err => console.error(err));
    else document.exitFullscreen();
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isJoined) {
    // ... KEEP YOUR EXACT EXISTING isJoined ENTRY SCREEN HERE ...
    // (Omitted for brevity, paste your name entry UI here)
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white font-sans p-4">
        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md flex flex-col gap-6 text-center">
          <h2 className="text-2xl font-bold text-blue-400">Join Room: {roomId}</h2>
          <form onSubmit={(e) => { e.preventDefault(); if (userName.trim()) setIsJoined(true); }} className="flex flex-col gap-4">
            <input type="text" placeholder="Your Name" value={userName} onChange={(e) => setUserName(e.target.value)} className="w-full bg-black/50 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 text-white" autoFocus required />
            <button type="submit" disabled={!userName.trim()} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg">Enter Watch Party</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div ref={roomContainerRef} className="flex h-screen overflow-hidden bg-gray-900 text-white font-sans relative">
      <div className={`flex-1 flex flex-col min-w-0 transition-all ${isFullscreen ? 'p-0' : 'p-4'}`}>
        {!isFullscreen && (
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white font-bold transition-colors">← Leave</button>
              
              {/* COPY ROOM CODE BUTTON */}
              <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                Room: <span className="text-blue-400 font-mono tracking-widest">{roomId}</span>
                <button onClick={copyRoomCode} className="ml-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 px-3 py-1 rounded-lg text-sm transition-colors shadow-sm flex items-center gap-2">
                  {copied ? '✅ Copied!' : '📋 Copy Code'}
                </button>
              </h2>

            </div>
            <div className="flex gap-4 items-center">
              <div className="text-sm bg-gray-800 px-3 py-1 rounded-full border border-gray-700">Playing as: <span className="text-green-400 font-bold">{userName}</span></div>
              <button onClick={toggleFullscreen} className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg text-sm font-bold shadow-lg transition-all">⛶ Full Screen</button>
            </div>
          </div>
        )}
        
        <div className={`flex-1 bg-black flex items-center justify-center overflow-hidden min-h-0 ${isFullscreen ? 'rounded-none border-none z-0' : 'rounded-xl border border-gray-700 mb-4 shadow-2xl'}`}>
          <VideoPlayer socket={socket} externalUrl={externalVideoUrl} />
        </div>

        {!isFullscreen && (
          <div className="h-48 bg-gray-800/50 rounded-xl border border-gray-700 flex items-center overflow-hidden">
            <VideoGrid socket={socket} roomId={roomId} setExternalVideoUrl={setExternalVideoUrl} userName={userName} />
          </div>
        )}
      </div>

      <div className={`transition-all duration-300 ease-in-out ${isFullscreen ? 'absolute top-0 right-0 h-full w-80 z-50 border-l border-white/10 backdrop-blur-md bg-black/40' : 'w-80 border-l border-gray-800 bg-gray-900/50 relative'}`}>
        {isFullscreen && <button onClick={toggleFullscreen} className="absolute top-4 left-[-40px] bg-black/60 p-2 rounded-l-lg hover:bg-red-600 transition-colors z-50 text-white shadow-lg">✖</button>}
        <Chat socket={socket} userName={userName} />
      </div>
    </div>
  );
}