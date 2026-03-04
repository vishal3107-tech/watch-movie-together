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
      <span className="absolute bottom-2 left-2 bg-black/70 text-xs px-2 py-1 rounded text-white shadow-lg">
        Friend
      </span>
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
    // Added Public STUN Servers to help devices connect across networks
    const peerConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    };

    const createPeer = (userToSignal, callerID, stream) => {
      const peer = new Peer({ initiator: true, trickle: false, stream, config: peerConfig });
      peer.on("data", data => {
        const decoded = JSON.parse(new TextDecoder().decode(data));
        if (decoded.type === 'FILE_TRANSFER') {
          const blob = new Blob([new Uint8Array(decoded.fileData)], { type: decoded.fileType });
          setExternalVideoUrl(URL.createObjectURL(blob));
        }
      });
      peer.on("signal", signal => socket.emit("sending-signal", { userToSignal, callerID, signal }));
      return peer;
    };

    const addPeer = (incomingSignal, callerID, stream) => {
      const peer = new Peer({ initiator: false, trickle: false, stream, config: peerConfig });
      peer.on("data", data => {
        const decoded = JSON.parse(new TextDecoder().decode(data));
        if (decoded.type === 'FILE_TRANSFER') {
          const blob = new Blob([new Uint8Array(decoded.fileData)], { type: decoded.fileType });
          setExternalVideoUrl(URL.createObjectURL(blob));
        }
      });
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

    window.sendVideoToPeers = (file) => {
      file.arrayBuffer().then(buffer => {
        const data = JSON.stringify({ type: 'FILE_TRANSFER', fileType: file.type, fileData: Array.from(new Uint8Array(buffer)) });
        peersRef.current.forEach(({ peer }) => peer.send(data));
      });
    };

    return () => { socket.off(); };
  }, [roomId, socket, setExternalVideoUrl]);

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsVideoEnabled(track.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsAudioEnabled(track.enabled);
      }
    }
  };

  return (
    <div className="flex w-full h-full gap-3 p-2 overflow-x-auto items-center">
      {/* LOCAL VIDEO WITH VISIBLE CONTROLS */}
      <div className="h-full min-w-[220px] relative flex flex-col gap-1">
        <div className="relative flex-1 rounded-lg overflow-hidden border-2 border-blue-500 bg-gray-900">
          <video playsInline muted autoPlay ref={userVideo} className={`h-full w-full object-cover ${!isVideoEnabled && 'opacity-0'}`} />
          {!isVideoEnabled && <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">Camera Off</div>}
          <span className="absolute bottom-2 left-2 bg-blue-600/80 text-xs px-2 py-1 rounded text-white shadow-lg">
            {userName} (You)
          </span>
        </div>
        
        {/* EXPLICIT MIC & CAMERA BUTTONS */}
        <div className="flex justify-center gap-2 mt-1">
          <button 
            onClick={toggleAudio} 
            className={`flex-1 py-1.5 rounded text-sm font-bold shadow transition-colors ${isAudioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-500'}`}
          >
            {isAudioEnabled ? '🎤 Mic On' : '🔇 Mic Off'}
          </button>
          <button 
            onClick={toggleVideo} 
            className={`flex-1 py-1.5 rounded text-sm font-bold shadow transition-colors ${isVideoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-500'}`}
          >
            {isVideoEnabled ? '🎥 Cam On' : '🚫 Cam Off'}
          </button>
        </div>
      </div>

      {/* REMOTE PEERS */}
      {peers.map((peer) => <PeerVideo key={peer.peerID} peer={peer.peer} />)}
    </div>
  );
}