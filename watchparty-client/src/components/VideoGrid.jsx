import { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';

const PeerVideo = ({ peer }) => {
  const ref = useRef();
  useEffect(() => {
    peer.on("stream", stream => { if (ref.current) ref.current.srcObject = stream; });
  }, [peer]);
  return (
    <div className="h-full min-w-[200px] relative rounded-lg overflow-hidden border border-gray-700 bg-black">
      <video playsInline autoPlay ref={ref} className="h-full w-full object-cover" />
      <span className="absolute bottom-2 left-2 bg-black/70 text-xs px-2 py-1 rounded text-white shadow-lg">Friend</span>
    </div>
  );
};

export default function VideoGrid({ socket, roomId, setExternalVideoUrl, userName }) {
  const [peers, setPeers] = useState([]);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  
  const userVideo = useRef();
  const peersRef = useRef([]); 
  const localStreamRef = useRef(null);

  useEffect(() => {
    const peerConfig = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };

    // 1. THE REASSEMBLER: Handles incoming binary chunks
    const handleData = (data, peer) => {
      // If the first byte is 123 ('{'), it might be our JSON metadata
      if (data[0] === 123) {
        try {
          const parsed = JSON.parse(new TextDecoder().decode(data));
          if (parsed.type === 'FILE_START') {
            peer.fileBuffer = [];
            peer.fileMeta = parsed;
            return;
          }
          if (parsed.type === 'FILE_END') {
            const blob = new Blob(peer.fileBuffer, { type: peer.fileMeta.fileType });
            setExternalVideoUrl(URL.createObjectURL(blob));
            peer.fileBuffer = []; // Clear memory after assembly
            return;
          }
        } catch (e) { /* Not JSON, it's just video data. Fall through. */ }
      }
      // 2. Push raw binary chunks directly into memory
      if (peer.fileBuffer) peer.fileBuffer.push(data);
    };

    const createPeer = (userToSignal, callerID, stream) => {
      const peer = new Peer({ initiator: true, trickle: false, stream, config: peerConfig });
      peer.on("data", data => handleData(data, peer));
      peer.on("signal", signal => socket.emit("sending-signal", { userToSignal, callerID, signal }));
      return peer;
    };

    const addPeer = (incomingSignal, callerID, stream) => {
      const peer = new Peer({ initiator: false, trickle: false, stream, config: peerConfig });
      peer.on("data", data => handleData(data, peer));
      peer.on("signal", signal => socket.emit("returning-signal", { signal, callerID }));
      peer.signal(incomingSignal);
      return peer;
    };

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      localStreamRef.current = stream;
      if (userVideo.current) userVideo.current.srcObject = stream;
      
      socket.emit("join-room", { roomID: roomId, userName: userName });

      socket.on("all-users", users => {
        const newPeers = users.map(userID => {
          const peer = createPeer(userID, socket.id, stream);
          peersRef.current.push({ peerID: userID, peer });
          return { peerID: userID, peer };
        });
        setPeers(newPeers);
      });

      socket.on("user-joined", payload => {
        const peer = addPeer(payload.signal, payload.callerID, stream);
        peersRef.current.push({ peerID: payload.callerID, peer });
        setPeers(users => [...users, { peerID: payload.callerID, peer }]);
      });

      socket.on("receiving-returned-signal", payload => {
        const item = peersRef.current.find(p => p.peerID === payload.id);
        if (item) item.peer.signal(payload.signal);
      });
      
      socket.on("user-disconnected", id => {
        const peerObj = peersRef.current.find(p => p.peerID === id);
        if (peerObj) peerObj.peer.destroy(); 
        peersRef.current = peersRef.current.filter(p => p.peerID !== id);
        setPeers(peers => peers.filter(p => p.peerID !== id));
      });
    });

    // 3. THE CHUNKER: Slices the file and streams it over the bus
    window.sendVideoToPeers = (file) => {
      // Trigger the loading UI via Socket
      socket.emit('start-file-share', { fileName: file.name });

      const CHUNK_SIZE = 16 * 1024; // 16KB packets
      let offset = 0;

      const meta = JSON.stringify({ type: 'FILE_START', fileType: file.type });
      peersRef.current.forEach(({ peer }) => peer.send(meta));

      const readNextChunk = () => {
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        slice.arrayBuffer().then(buffer => {
          peersRef.current.forEach(({ peer }) => peer.send(buffer));
          offset += buffer.byteLength;
          if (offset < file.size) {
            readNextChunk(); // Loop until finished
          } else {
            const endMeta = JSON.stringify({ type: 'FILE_END' });
            peersRef.current.forEach(({ peer }) => peer.send(endMeta));
          }
        });
      };
      readNextChunk();
    };

    return () => { 
      socket.off("all-users");
      socket.off("user-joined");
      socket.off("receiving-returned-signal");
      socket.off("user-disconnected");
    };
  }, [roomId, socket, setExternalVideoUrl, userName]);

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getVideoTracks()[0];
      if (track) { track.enabled = !track.enabled; setIsVideoEnabled(track.enabled); }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) { track.enabled = !track.enabled; setIsAudioEnabled(track.enabled); }
    }
  };

  return (
    <div className="flex w-full h-full gap-3 p-2 overflow-x-auto items-center">
      <div className="h-full min-w-[220px] relative flex flex-col gap-1">
        <div className="relative flex-1 rounded-lg overflow-hidden border-2 border-blue-500 bg-gray-900">
          <video playsInline muted autoPlay ref={userVideo} className={`h-full w-full object-cover ${!isVideoEnabled && 'opacity-0'}`} />
          {!isVideoEnabled && <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">Camera Off</div>}
          <span className="absolute bottom-2 left-2 bg-blue-600/80 text-xs px-2 py-1 rounded text-white shadow-lg">{userName} (You)</span>
        </div>
        
        <div className="flex justify-center gap-2 mt-1">
          <button onClick={toggleAudio} className={`flex-1 py-1.5 rounded text-sm font-bold shadow transition-colors ${isAudioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-500'}`}>
            {isAudioEnabled ? '🎤 Mic On' : '🔇 Mic Off'}
          </button>
          <button onClick={toggleVideo} className={`flex-1 py-1.5 rounded text-sm font-bold shadow transition-colors ${isVideoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-500'}`}>
            {isVideoEnabled ? '🎥 Cam On' : '🚫 Cam Off'}
          </button>
        </div>
      </div>
      {peers.map((peer) => <PeerVideo key={peer.peerID} peer={peer.peer} />)}
    </div>
  );
}