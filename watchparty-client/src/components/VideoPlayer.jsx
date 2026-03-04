import { useEffect, useRef, useState } from 'react';
import ReactPlayer from 'react-player';

export default function VideoPlayer({ socket }) {
  const playerRef = useRef(null);
  const nativeRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [url, setUrl] = useState('');
  const [playing, setPlaying] = useState(false);
  const [isLocal, setIsLocal] = useState(false);
  const isTargetOfEvent = useRef(false);

  useEffect(() => {
    // Listen for the metadata that tells us a file is being streamed
    socket.on('incoming-stream-metadata', () => {
      // This tells the receiver to prepare for a video
      setIsLocal(true);
      setPlaying(true);
    });

    socket.on('video-event', (data) => {
      isTargetOfEvent.current = true;
      if (data.type === 'play') setPlaying(true);
      if (data.type === 'pause') setPlaying(false);
      if (data.type === 'seek') {
        if (isLocal) { nativeRef.current.currentTime = data.time; }
        else { playerRef.current?.seekTo(data.time, 'seconds'); }
      }
      setTimeout(() => { isTargetOfEvent.current = false; }, 200);
    });

    return () => socket.off('video-event');
  }, [socket, isLocal]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const blobUrl = URL.createObjectURL(file);
      setUrl(blobUrl);
      setIsLocal(true);
      setPlaying(true);

      // 1. Tell the server to tell others a file is coming
      socket.emit('start-file-share', { name: file.name });
      
      // 2. Technical Note: To truly stream the BYTES, you would call 
      // the sendFileToPeers function here.
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-black relative group overflow-hidden">
      <div className="flex-1 w-full h-full">
        {isLocal || url.startsWith('blob:') ? (
          <video
            ref={nativeRef}
            src={url}
            autoPlay={playing}
            controls
            className="w-full h-full object-contain"
            onPlay={() => !isTargetOfEvent.current && socket.emit('video-event', { type: 'play', time: nativeRef.current.currentTime })}
            onPause={() => !isTargetOfEvent.current && socket.emit('video-event', { type: 'pause', time: nativeRef.current.currentTime })}
          />
        ) : (
          <ReactPlayer
            ref={playerRef}
            url={url}
            playing={playing}
            controls={true}
            width="100%"
            height="100%"
            onPlay={() => !isTargetOfEvent.current && socket.emit('video-event', { type: 'play', time: playerRef.current.getCurrentTime() })}
            onPause={() => !isTargetOfEvent.current && socket.emit('video-event', { type: 'pause', time: playerRef.current.getCurrentTime() })}
          />
        )}
      </div>

      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

      <div className="absolute top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 p-2 rounded-full backdrop-blur-md">
        <button onClick={() => fileInputRef.current.click()} className="bg-blue-600 p-2 rounded-full">
          📂 Stream File to Friends
        </button>
      </div>
    </div>
  );
}