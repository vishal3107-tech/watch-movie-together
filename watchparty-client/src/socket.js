// src/socket.js
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://watch-movie-together.onrender.com/';

// This creates ONE single instance of the socket for the entire app
export const socket = io(SERVER_URL);