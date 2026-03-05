import { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';

// Now accepts peerName prop!
const PeerVideo = ({ peer, peerName }) => {
  const ref = useRef();
  useEffect(() => {
    peer.on("stream", stream => { if (ref.current) ref.current.srcObject = stream; });
  }, [peer]);
  return (
    <div className="h-full min-w-[200px] relative rounded-lg overflow-hidden border border-gray-700 bg-black">
      <video playsInline autoPlay ref={ref} className="h-full w-full object-cover" />
      <span className="absolute bottom-2 left-2 bg-black/70 text-xs px-2 py-1 rounded text-white shadow-lg">{peerName}</span>
    </div>
  );
};

export default function VideoGrid({ socket, roomId, setExternalVideoUrl, userName }) {
  const [peers, setPeers] = useState([]);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false); // Screen share state
  
  const userVideo = useRef();
  const peersRef = useRef([]); 
  const localStreamRef = useRef(null);

  useEffect(() => {
    const peerConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

    const handleData = (data, peer) => {
      if (data[0] === 123) {
        try {
          const parsed = JSON.parse(new TextDecoder().decode(data));
          if (parsed.type === 'FILE_START') { peer.fileBuffer = []; peer.fileMeta = parsed; return; }
          if (parsed.type === 'FILE_END') {
            const blob = new Blob(peer.fileBuffer, { type: peer.fileMeta.fileType });
            setExternalVideoUrl(URL.createObjectURL(blob));
            peer.fileBuffer = []; return;
          }
        } catch (e) {}
      }
      if (peer.fileBuffer) peer.fileBuffer.push(data);
    };

    const createPeer = (userToSignal, callerID, stream) => {
      const peer = new Peer({ initiator: true, trickle: false, stream, config: peerConfig });
      peer.on("data", data => handleData(data, peer));
      // Pass callerName through signal
      peer.on("signal", signal => socket.emit("sending-signal", { userToSignal, callerID, signal, callerName: userName }));
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
        const newPeers = users.map(userObj => {
          const peer = createPeer(userObj.id, socket.id, stream);
          peersRef.current.push({ peerID: userObj.id, peer, peerName: userObj.name });
          return { peerID: userObj.id, peer, peerName: userObj.name }; // Map names!
        });
        setPeers(newPeers);
      });

      socket.on("user-joined", payload => {
        const peer = addPeer(payload.signal, payload.callerID, stream);
        peersRef.current.push({ peerID: payload.callerID, peer, peerName: payload.callerName });
        setPeers(users => [...users, { peerID: payload.callerID, peer, peerName: payload.callerName }]);
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
      socket.emit('start-file-share', { fileName: file.name });
      const CHUNK_SIZE = 16 * 1024;
      let offset = 0;
      peersRef.current.forEach(({ peer }) => peer.send(JSON.stringify({ type: 'FILE_START', fileType: file.type })));
      const readNextChunk = () => {
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        slice.arrayBuffer().then(buffer => {
          peersRef.current.forEach(({ peer }) => peer.send(buffer));
          offset += buffer.byteLength;
          if (offset < file.size) readNextChunk();
          else peersRef.current.forEach(({ peer }) => peer.send(JSON.stringify({ type: 'FILE_END' })));
        });
      };
      readNextChunk();
    };

    return () => { 
      socket.off("all-users"); socket.off("user-joined"); socket.off("receiving-returned-signal"); socket.off("user-disconnected");
    };
  }, [roomId, socket, setExternalVideoUrl, userName]);

  // SCREEN SHARE LOGIC
  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const oldTrack = localStreamRef.current.getVideoTracks()[0];

        // Replace track over WebRTC without dropping connection
        peersRef.current.forEach(({ peer }) => peer.replaceTrack(oldTrack, screenTrack, localStreamRef.current));
        
        // Update local display
        if (userVideo.current) userVideo.current.srcObject = new MediaStream([screenTrack]);
        
        screenTrack.onended = () => stopScreenShare(); // Handle clicking "Stop sharing" on browser toolbar
        setIsScreenSharing(true);
      } catch (err) { console.error("Screen share canceled", err); }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    navigator.mediaDevices.getUserMedia({ video: true }).then(camStream => {
      const camTrack = camStream.getVideoTracks()[0];
      const oldTrack = localStreamRef.current.getVideoTracks()[0]; // The screen track
      
      peersRef.current.forEach(({ peer }) => peer.replaceTrack(oldTrack, camTrack, localStreamRef.current));
      
      localStreamRef.current.removeTrack(oldTrack);
      localStreamRef.current.addTrack(camTrack);
      if (userVideo.current) userVideo.current.srcObject = localStreamRef.current;
      
      setIsScreenSharing(false);
      setIsVideoEnabled(true);
    });
  };

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
      <div className="h-full min-w-[280px] relative flex flex-col gap-1">
        <div className="relative flex-1 rounded-lg overflow-hidden border-2 border-blue-500 bg-gray-900">
          <video playsInline muted autoPlay ref={userVideo} className={`h-full w-full object-cover ${!isVideoEnabled && 'opacity-0'}`} />
          {!isVideoEnabled && <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">Camera Off</div>}
          <span className="absolute bottom-2 left-2 bg-blue-600/80 text-xs px-2 py-1 rounded text-white shadow-lg">{userName} (You)</span>
        </div>
        
        <div className="flex justify-center gap-2 mt-1">
          <button onClick={toggleAudio} className={`flex-1 py-1 rounded text-xs font-bold shadow ${isAudioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-500'}`}>🎤</button>
          <button onClick={toggleVideo} className={`flex-1 py-1 rounded text-xs font-bold shadow ${isVideoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-500'}`}>🎥</button>
          {/* SCREEN SHARE BUTTON */}
          <button onClick={toggleScreenShare} className={`flex-1 py-1 rounded text-xs font-bold shadow ${isScreenSharing ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'}`}>
            💻 Share
          </button>
        </div>
      </div>
      {peers.map((peer) => <PeerVideo key={peer.peerID} peer={peer.peer} peerName={peer.peerName} />)}
    </div>
  );
}