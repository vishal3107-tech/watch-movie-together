import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const navigate = useNavigate();

  const createRoom = () => {
    const roomId = uuidv4(); // Generates a unique string
    navigate(`/room/${roomId}`);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-5xl font-bold mb-8 text-blue-400">Watch Party</h1>
      <button 
        onClick={createRoom}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-lg font-semibold transition-colors shadow-lg"
      >
        Create a New Room
      </button>
    </div>
  );
}