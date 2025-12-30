import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBn3t6-jgzNvsl98ng8I_nb8hATqMudc-w",
  authDomain: "director-eye.firebaseapp.com",
  databaseURL: "https://director-eye-default-rtdb.firebaseio.com",
  projectId: "director-eye",
  storageBucket: "director-eye.firebasestorage.app",
  messagingSenderId: "906862467102",
  appId: "1:906862467102:web:b1fa6ac76f9d661bf6760f",
  measurementId: "G-22JKV513V4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, analytics, db, storage };
