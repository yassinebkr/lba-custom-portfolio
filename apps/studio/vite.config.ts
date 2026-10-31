import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],base:'./',server:{port:5174,fs:{allow:[new URL('../../',import.meta.url).pathname]}}});
