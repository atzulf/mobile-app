import axios from 'axios';
import { Platform } from 'react-native';

// Menggunakan URL backend Vercel agar aplikasi selalu terhubung dari mana saja
const BASE_URL = 'https://backendcatetanduit.vercel.app';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});
