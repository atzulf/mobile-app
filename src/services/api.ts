import axios from 'axios';
import { Platform } from 'react-native';

// Gunakan 10.0.2.2 untuk Android Emulator, atau IP lokal Anda jika menggunakan fisik/Expo Go (misal 192.168.x.x)
// Sementara untuk iOS Simulator gunakan localhost
const BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});
