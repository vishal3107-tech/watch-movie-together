import { useEffect, useRef, useState } from 'react';
import ReactPlayer from 'react-player';

export default function VideoPlayer({ socket, externalUrl }) {
  const playerRef = useRef(null);
  const nativeRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Starting with a default video so the player isn't empty on load
  const [url, setUrl] = useState('https://www.youtube.com/watch?v=aqz-KE-bpKQ'); 
  const [playing, setPlaying] = useState(false);
  const [isLocal, setIsLocal] = useState(false);
  const isLocalRef = useRef(isLocal);
  const isTargetOfEvent = useRef(false);

  const [isReceiving, setIsReceiving] = useState(false);
  const [incomingFileName, setIncomingFileName] = useState('');

  useEffect(() => {
    isLocalRef.current = isLocal;
  }, [isLocal]);

  // Handle incoming P2P file announcements
  useEffect(() => {
    const handleFileStart = (data) => {
      setIsReceiving(true);
      setIncomingFileName(data.fileName);
    };
    socket.on('start-file-share', handleFileStart);
    return () => socket.off('start-file-share', handleFileStart);
  }, [socket]);

  // Handle completed P2P file transfers
  useEffect(() => {
    if (externalUrl && externalUrl !== url) {
      setUrl(externalUrl);
      setIsLocal(true);
      setPlaying(true);
      setIsReceiving(false); 
    }
  }, [externalUrl, url]);

  // Handle all synced video events (Play, Pause, Seek, and URL changes)
  useEffect(() => {
    const handleVideoEvent = (data) => {
      isTargetOfEvent.current = true;
      if (data.type === 'play') setPlaying(true);
      if (data.type === 'pause') setPlaying(false);
      
      if (data.type === 'seek') {
        if (isLocalRef.current) { 
          if (nativeRef.current) nativeRef.current.currentTime = data.time; 
        } else { 
          if (playerRef.current) playerRef.current.seekTo(data.time, 'seconds'); 
        }
      }

      // NEW: Catch URL changes from friends and update the player
      if (data.type === 'url-change') {
        setUrl(data.url);
        setIsLocal(false);
      }

      setTimeout(() => { isTargetOfEvent.current = false; }, 200);
    };

    socket.on('video-event', handleVideoEvent);
    return () => socket.off('video-event', handleVideoEvent);
  }, [socket]);

  const emit = (type, time) => {
    if (!isTargetOfEvent.current) {
      const t = time || (isLocalRef.current ? nativeRef.current?.currentTime : playerRef.current?.getCurrentTime());
      socket.emit('video-event', { type, time: t });
    }
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (file) {
      const localUrl = URL.createObjectURL(file);
      setUrl(localUrl);
      setIsLocal(true);
      setPlaying(true);
      if (window.sendVideoToPeers) window.sendVideoToPeers(file);
    }
  };

  // NEW: Handle pasting a YouTube/Vimeo URL
  const handleUrlSubmit = (e) => {
    if (e.key === 'Enter' && e.target.value.trim() !== '') {
      const newUrl = e.target.value.trim();
      setUrl(newUrl);
      setIsLocal(false);
      
      // Broadcast the new URL to everyone in the room
      socket.emit('video-event', { type: 'url-change', url: newUrl });
      e.target.value = ''; // Clear the input box after pressing enter
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-black relative group overflow-hidden">
      
      {isReceiving && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-white font-bold tracking-wider animate-pulse">
              Receiving <span className="text-blue-400">{incomingFileName}</span> over P2P...
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 w-full h-full">
        {isLocal ? (
          <video
            ref={nativeRef} src={url} autoPlay={playing} controls
            className="w-full h-full object-contain"
            onPlay={() => emit('play')}
            onPause={() => emit('pause')}
            onSeeked={() => emit('seek', nativeRef.current.currentTime)}
          />
        ) : (
          <ReactPlayer 
            ref={playerRef} url={url} playing={playing} controls width="100%" height="100%" 
            onPlay={() => emit('play')}
            onPause={() => emit('pause')}
            onSeek={(sec) => emit('seek', sec)}
          />
        )}
      </div>

      <input type="file" ref={fileInputRef} onChange={handleFile} className="hidden" />
      
      {/* UPDATED: The floating control bar now has both File Upload and URL Input */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 p-2 rounded-full backdrop-blur-md z-40 flex items-center gap-3 border border-gray-600 shadow-2xl">
        
        <button onClick={() => fileInputRef.current.click()} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-full text-white text-xs font-bold shadow-lg transition-colors whitespace-nowrap">
          📂 Stream File
        </button>

        {/* Visual Divider */}
        <div className="h-6 w-px bg-gray-500"></div>

        <input
          type="text"
          placeholder="Paste YouTube Link + Enter..."
          onKeyDown={handleUrlSubmit}
          className="bg-transparent border-none text-sm text-white focus:outline-none focus:ring-0 w-64 placeholder-gray-400 px-2"
        />
      </div>
    </div>
  );
}