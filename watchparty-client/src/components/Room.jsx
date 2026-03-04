import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import Chat from './Chat';
import VideoPlayer from './VideoPlayer';
import VideoGrid from './VideoGrid'; // <-- Import the new component

const socket = io('http://localhost:5000'); 

export default function Room() {
  const { roomId } = useParams();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-900 text-white">
      <div className="flex-1 flex flex-col p-4 min-w-0">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Watch Party</h2>
          <div className="bg-gray-800 px-4 py-2 rounded text-sm">
            Room ID: <span className="font-mono text-blue-400">{roomId}</span>
          </div>
        </div>
        
        {/* Phase 3: Synchronized Video */}
        <div className="flex-1 rounded-lg border border-gray-700 flex items-center justify-center overflow-hidden mb-4 min-h-0">
          <VideoPlayer socket={socket} />
        </div>

        {/* Phase 4: WebRTC Webcams */}
        <div className="h-40 bg-gray-800 rounded-lg border border-gray-700 flex items-center overflow-hidden">
          <VideoGrid socket={socket} roomId={roomId} />
        </div>
      </div>

      <Chat socket={socket} />
    </div>
  );
}