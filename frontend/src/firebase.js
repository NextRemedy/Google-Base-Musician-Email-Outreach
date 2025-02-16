// Import the functions you need from the Firebase SDKs
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // Import Firestore

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBabLXMRPYDFm6vMaelVTlwNKKdPpv664E",
  authDomain: "nextremedy-musician-outr-bfc85.firebaseapp.com",
  projectId: "nextremedy-musician-outr-bfc85",
  storageBucket: "nextremedy-musician-outr-bfc85.appspot.com",
  messagingSenderId: "749885358469",
  appId: "1:749885358469:web:73b3c41802f3c26afcc4ec",
  measurementId: "G-TB5BDV7XFR",
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(firebaseApp);

// Initialize Firestore and export it
export const db = getFirestore(firebaseApp); // Add this line to initialize Firestore

export default firebaseApp;
