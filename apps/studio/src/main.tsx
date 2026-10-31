import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
const node=document.getElementById('root');
if(!node)throw new Error('Missing studio root');
createRoot(node).render(<React.StrictMode><App/></React.StrictMode>);
