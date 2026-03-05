import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket'; // <-- Importing the shared socket

export default function Home() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const generateRoomId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreateRoom = () => {
    navigate(`/room/${generateRoomId()}`);
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    
    if (code.length > 0) {
      // 1. Check if the server is awake
      if (!socket.connected) {
        setErrorMsg('Waiting for server to wake up... try again in 5 seconds! ⏳');
        setTimeout(() => setErrorMsg(''), 4000);
        return;
      }

      // 2. Validate the room
      socket.emit('check-room', code, (response) => {
        if (response && response.exists) {
          navigate(`/room/${code}`);
        } else {
          setErrorMsg('No room exists with this code! ❌');
          setTimeout(() => setErrorMsg(''), 3000); 
        }
      });
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-900 text-white font-sans">
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 w-96 flex flex-col gap-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-blue-400">Watch Party</h1>
        <p className="text-gray-400 text-sm mb-2">Watch videos in sync with friends.</p>

        <button onClick={handleCreateRoom} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-transform active:scale-95">
          Create New Room
        </button>

        <div className="flex items-center gap-3">
          <hr className="flex-1 border-gray-600" />
          <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">OR</span>
          <hr className="flex-1 border-gray-600" />
        </div>

        <form onSubmit={handleJoinRoom} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Enter 6-Digit Code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="w-full bg-black/50 border border-gray-600 rounded-lg px-4 py-3 text-center text-lg font-mono tracking-widest focus:outline-none focus:border-blue-500 uppercase transition-colors"
          />
          {errorMsg && <p className="text-red-500 text-sm font-bold animate-pulse">{errorMsg}</p>}
          
          <button type="submit" disabled={joinCode.length === 0} className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-transform active:scale-95">
            Join Room
          </button>
        </form>
      </div>
    </div>
  );
}