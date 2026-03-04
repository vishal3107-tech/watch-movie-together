import { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';

const PeerVideo = ({ peer }) => {
  const ref = useRef();
  useEffect(() => {
    peer.on("stream", stream => { if (ref.current) ref.current.srcObject = stream; });
  }, [peer]);
  return <video playsInline autoPlay ref={ref} className="h-full w-full object-cover rounded-lg border border-gray-700 bg-black" />;
};

export default function VideoGrid({ socket, roomId, setExternalVideoUrl }) {
  const [peers, setPeers] = useState([]);
  const userVideo = useRef();
  const peersRef = useRef([]); 

  useEffect(() => {
    const createPeer = (userToSignal, callerID, stream) => {
      const peer = new Peer({ initiator: true, trickle: false, stream });
      
      // LISTEN FOR FILE DATA
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
      const peer = new Peer({ initiator: false, trickle: false, stream });
      
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
      if (userVideo.current) userVideo.current.srcObject = stream;
      socket.emit("join-room", roomId);

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
    });

    // Global function to broadcast the file
    window.sendVideoToPeers = (file) => {
      file.arrayBuffer().then(buffer => {
        const data = JSON.stringify({
          type: 'FILE_TRANSFER',
          fileType: file.type,
          fileData: Array.from(new Uint8Array(buffer))
        });
        peersRef.current.forEach(({ peer }) => peer.send(data));
      });
    };

    return () => { socket.off(); };
  }, [roomId, socket, setExternalVideoUrl]);

  return (
    <div className="flex w-full h-full gap-2 p-2 overflow-x-auto items-center">
      <div className="h-full min-w-[200px] relative">
        <video playsInline muted autoPlay ref={userVideo} className="h-full w-full object-cover rounded-lg border border-blue-500 bg-black" />
        <span className="absolute bottom-2 left-2 bg-black/60 text-[10px] px-2 py-0.5 rounded text-white">You</span>
      </div>
      {peers.map((peer) => <PeerVideo key={peer.peerID} peer={peer.peer} />)}
    </div>
  );
}