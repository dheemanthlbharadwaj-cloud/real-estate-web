// Connects the site to its Firebase project (mybto-ce84f, web app "MyBTO web").
// Hosting serves the site; nothing else in Firebase is used yet (rankings go to the Google Sheet).
// This web config is public by design. Add Firebase products here if they are ever needed.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyBG6D1azDz6Bc_nWxgQRxY5mFDj4E4Euss',
  authDomain: 'mybto-ce84f.firebaseapp.com',
  projectId: 'mybto-ce84f',
  storageBucket: 'mybto-ce84f.firebasestorage.app',
  messagingSenderId: '988755619847',
  appId: '1:988755619847:web:f26d8cbb32088f29c6baa2',
};

export const app = initializeApp(firebaseConfig);
