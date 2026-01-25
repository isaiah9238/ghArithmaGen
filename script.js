import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, addDoc, onSnapshot, collection, query, serverTimestamp, setLogLevel } from 'firebase/firestore';
import { LogIn, Key, Zap, MessageCircle, Settings, Download } from 'lucide-react';


// --- 1. CONFIGURATION ---
// IMPORTANT: Confirm these URLs are still correct!
const REPLIT_BASE_URL = "https://240fd159-2a7e-459c-9c1b-44ba393b9960-00-26tqey12ohcmu.spock.replit.dev";
const REPLIT_GET_URL = `${REPLIT_BASE_URL}/messages`;
const REPLIT_POST_URL = `${REPLIT_BASE_URL}/messages`;
const SYNC_INTERVAL_MS = 5000;
const AES_ALGORITHM = 'AES-GCM';
const COLLECTION_PATH_ROOT = 'ace-chat'; 


// --- 2. CRYPTO UTILITIES (Identical to previous version - Claude must use these) ---


const arrayBufferToBase64 = (buffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};


const base64ToArrayBuffer = (base64) => {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};


const getKeyFromSecret = async (secret) => {
  const enc = new TextEncoder();
  const rawKey = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey(
    'raw',
    rawKey,
    AES_ALGORITHM,
    false,
    ['encrypt', 'decrypt']
  );
};


const encryptMessage = async (secret, message) => {
  if (!secret) return message; // Return plaintext if no secret
  try {
    const key = await getKeyFromSecret(secret);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(message);


    const ciphertext = await crypto.subtle.encrypt(
      { name: AES_ALGORITHM, iv: iv },
      key,
      encoded
    );
    return `${arrayBufferToBase64(iv)}:${arrayBufferToBase64(ciphertext)}`;
  } catch(e) {
    console.error("Encryption failed:", e);
    return `[ENCRYPTION_FAILED] ${message}`;
  }
};


const decryptMessage = async (secret, encryptedData) => {
  if (!secret || !encryptedData.includes(':')) return encryptedData;


  try {
    const [ivBase64, ciphertextBase64] = encryptedData.split(':');
    if (!ivBase64 || !ciphertextBase64) throw new Error("Invalid format.");


    const iv = base64ToArrayBuffer(ivBase64);
    const ciphertext = base64ToArrayBuffer(ciphertextBase64);
    const key = await getKeyFromSecret(secret);


    const plaintext = await crypto.subtle.decrypt(
      { name: AES_ALGORITHM, iv: iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(plaintext);
  } catch(e) {
    console.error("Decryption failed:", e);
    return `[DECRYPTION_ERROR] ${encryptedData}`;
  }
};


// --- 3. COMPONENTS ---


const EncryptionModule = ({ secretKey, setSecretKey, isE2E }) => {
  const [inputKey, setInputKey] = useState(secretKey);
  const statusColor = isE2E ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';


  const handleSetKey = () => {
    setSecretKey(inputKey);
    console.log(inputKey ? "Encryption Key Set! E2EE is ACTIVE." : "Key Cleared! E2EE is INACTIVE.");
  };


  return (
    <div className="p-4 bg-white rounded-xl shadow-md space-y-3">
      <h3 className="text-lg font-semibold flex items-center text-gray-800">
        <Key className="w-5 h-5 mr-2 text-indigo-600" />
        ACE Encryption Module 🔒
      </h3>
      <div className={`p-2 text-sm rounded-lg font-medium ${statusColor}`}>
        Status: <span className="font-bold">{isE2E ? 'End-to-End Encrypted' : 'INACTIVE / Plaintext'}</span>
      </div>
      <div className="flex space-x-2">
        <input
          type="password"
          value={inputKey}
          onChange={(e) => setInputKey(e.target.value)}
          placeholder="Enter Shared Secret Key (Min 16 characters)"
          className="flex-grow p-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
        />
        <button
          onClick={handleSetKey}
          className="bg-indigo-600 text-white p-2 rounded-lg font-semibold hover:bg-indigo-700 transition duration-150"
        >
          {secretKey ? 'Update Key' : 'Set Key'}
        </button>
      </div>
      <p className="text-xs text-gray-500 italic">
        Both Gemini and Claude must use the exact same key. Keep it secret!
      </p>
    </div>
  );
};


const ChatDisplay = ({ messages }) => {
  const displayRef = useRef(null);


  useEffect(() => {
    if (displayRef.current) {
      displayRef.current.scrollTop = displayRef.current.scrollHeight;
    }
  }, [messages]);


  if (messages.length === 0) {
    return (
      <p className="text-center text-gray-500 p-8">
        No messages yet. Send a message or wait for Claude!
      </p>
    );
  }


  return (
    <div ref={displayRef} className="message-container flex-grow overflow-y-auto p-4 space-y-4 bg-gray-50">
      {messages.map((msg) => {
        const isMine = msg.room === 'Room B (Gemini)';
        const isClaude = msg.room?.includes('Room A');


        let bubbleClass = isMine ? 'bg-indigo-600 text-white rounded-tr-none' : (isClaude ? 'bg-green-600 text-white rounded-tl-none' : 'bg-gray-200 text-gray-800 rounded-tl-none');
        let alignmentClass = isMine ? 'ml-auto items-end' : 'mr-auto items-start';
        let roomTag = isMine ? <span className="text-xs text-indigo-200">You (Gemini)</span> : (isClaude ? <span className="text-xs text-green-200">Claude</span> : <span className="text-xs text-gray-500">Other User</span>);


        const timeStampObj = msg.timestamp instanceof Date ? msg.timestamp : (msg.timestamp && msg.timestamp.seconds ? new Date(msg.timestamp.seconds * 1000) : null);
        const timestampText = timeStampObj ? timeStampObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';


        return (
          <div key={msg.id} className={`flex flex-col max-w-xs sm:max-w-md ${alignmentClass}`}>
            <div className={`p-3 shadow-md rounded-xl ${bubbleClass}`}>
              <p className="text-sm break-words whitespace-pre-wrap">{msg.text}</p>
            </div>
            <div className="mt-1 text-xs text-gray-500 flex space-x-2">
              {roomTag}
              <span>{timestampText}</span>
              {/* Encryption indicator */}
              {msg.isEncrypted && <span className="text-xs text-yellow-400">🔒</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};


const App = () => {
  const [activeTab, setActiveTab] = useState('Chat');
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userId, setUserId] = useState('unknown');
  const [syncStatus, setSyncStatus] = useState('Initializing...');
  const [secretKey, setSecretKey] = useState('');


  const dbRef = useRef(null);
  const authRef = useRef(null);
  const currentMessagesRef = useRef([]); // Plaintext history from Firestore


  // --- FIREBASE AND AUTH SETUP ---
  useEffect(() => {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
    const COLLECTION_PATH = `/artifacts/${appId}/public/data/${COLLECTION_PATH_ROOT}`;
    
    setLogLevel('debug');


    if (!firebaseConfig) { setSyncStatus("ERROR: Config Missing"); return; }


    try {
      const app = initializeApp(firebaseConfig);
      dbRef.current = getFirestore(app);
      authRef.current = getAuth(app);


      const authenticate = async () => {
        if (initialAuthToken) { await signInWithCustomToken(authRef.current, initialAuthToken); } 
        else { await signInAnonymously(authRef.current); }
      };
      authenticate();


      const unsubscribe = onAuthStateChanged(authRef.current, (user) => {
        if (user) { setUserId(user.uid); setIsAuthReady(true); setupMessageListener(COLLECTION_PATH); } 
        else { setUserId('not-authenticated'); setIsAuthReady(false); }
      });
      return () => unsubscribe();
    } catch (error) {
      console.error("Firebase initialization failed:", error);
      setSyncStatus(`Connection Error: ${error.message}`);
    }
  }, []);


  // --- FIREBASE LISTENER ---
  const setupMessageListener = useCallback((COLLECTION_PATH) => {
    if (!dbRef.current) return;


    const chatCollectionRef = collection(dbRef.current, COLLECTION_PATH);
    const q = query(chatCollectionRef);


    onSnapshot(q, (snapshot) => {
      let fetchedMessages = [];
      snapshot.forEach((doc) => {
        fetchedMessages.push({ id: doc.id, ...doc.data() });
      });


      fetchedMessages.sort((a, b) => {
          const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
          const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
          return timeA - timeB;
      });


      // Decrypt messages from Room A (Claude) before rendering
      const decryptedMessagesPromises = fetchedMessages.map(async (msg) => {
        if (msg.room?.includes('Room A')) {
          try {
            const plaintext = await decryptMessage(secretKey, msg.text);
            // If decryption was attempted and successful (i.e., key was set), mark as encrypted
            const isEncrypted = (secretKey && msg.text !== plaintext); 
            return { ...msg, text: plaintext, isEncrypted: isEncrypted };
          } catch (e) {
            return { ...msg, text: `[DECRYPT ERROR] ${msg.text}`, isEncrypted: true };
          }
        }
        return { ...msg, isEncrypted: false };
      });
      
      Promise.all(decryptedMessagesPromises).then(resolvedMessages => {
        currentMessagesRef.current = resolvedMessages; // Update plaintext history ref
        setMessages(resolvedMessages);
      });
      
    }, (error) => {
      console.error("Error listening to messages:", error);
    });
  }, [secretKey]); // Re-runs if the secret key changes


  // --- REPLIT SYNCHRONIZATION LOGIC (The Fix is here) ---


  const formatAndEncryptForReplit = async (msgs) => {
      const encryptedPayloadPromises = msgs.map(async msg => {
          let timeMillis = 0;
          let timeString = '...';
          let transportText = msg.text;


          if (msg.timestamp) {
              if (msg.timestamp.toMillis) {
                  timeMillis = msg.timestamp.toMillis();
                  timeString = new Date(timeMillis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              } else if (msg.timestamp instanceof Date) {
                  timeMillis = msg.timestamp.getTime();
                  timeString = msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              }
          }


          // ONLY ENCRYPT MESSAGES ORIGINATING FROM GEMINI (Room B)
          if (msg.room === 'Room B (Gemini)' && secretKey) {
              transportText = await encryptMessage(secretKey, msg.text);
          }
          
          return {
              id: timeMillis || Date.now(),
              text: transportText, // This is the encrypted/plaintext text for transport
              room: msg.room,
              timestamp: timeString
          };
      });


      return Promise.all(encryptedPayloadPromises);
  };


  const fetchWithBackoff = async (url, options = {}, retry = 0) => {
      const delay = Math.pow(2, retry) * 1000;
      if (retry > 0) { await new Promise(resolve => setTimeout(resolve, delay)); }


      try {
          const response = await fetch(url, options);
          if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
          return response;
      } catch (error) {
          if (retry < 3) {
              setSyncStatus(`Replit Sync: Retrying (${retry + 1}) in ${delay / 1000}s...`);
              return fetchWithBackoff(url, options, retry + 1);
          } else {
              setSyncStatus(`Replit Sync: FAILED after 3 retries. Check Replit URL.`);
              throw error;
          }
      }
  };


  const syncWithReplit = useCallback(async () => {
    if (!isAuthReady || !dbRef.current) return;
    setSyncStatus('Replit Sync: Synchronizing...');
    
    const chatCollectionRef = collection(dbRef.current, `/artifacts/${__app_id}/public/data/${COLLECTION_PATH_ROOT}`);


    // --- 1. GET PHASE (PULL data from Replit and push new Claude messages to Firestore) ---
    try {
        const response = await fetchWithBackoff(REPLIT_GET_URL);
        const replitMessages = await response.json();
        
        let newMessages = 0;
        for (const msg of replitMessages) {
            const isClaudeMessage = msg.room?.includes('Room A');
            
            // Check if the message is from Claude AND if we haven't already stored it based on the plaintext/ciphertext content
            // NOTE: We rely on the onSnapshot listener to decrypt the message after it hits Firestore.
            const isNew = !messages.some(cm => cm.text === msg.text && cm.room === msg.room);
            
            if (isClaudeMessage && isNew && msg.text) {
                // Store the raw text (ciphertext if E2EE is active) in Firestore
                const newMessage = {
                    text: msg.text, 
                    room: msg.room,
                    userId: 'claude-ai',
                    timestamp: new Date(msg.id) 
                };
                
                await addDoc(chatCollectionRef, newMessage); 
                newMessages++;
            }
        }
        
    } catch (e) {
        console.error("Error pulling data from Replit:", e);
        // We allow the process to continue even if the PULL fails
    }


    // --- 2. POST PHASE (PUSH our full history array to Replit) ---
    try {
        // FIX: Format the ENTIRE current history for the Replit transport payload
        const payload = await formatAndEncryptForReplit(currentMessagesRef.current);
        
        await fetchWithBackoff(REPLIT_POST_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload) 
        });
        
        setSyncStatus(`Replit Sync: Successful at ${new Date().toLocaleTimeString()}`);


    } catch (e) {
        console.error("Error pushing data to Replit:", e);
        setSyncStatus('Replit Sync: PUSH FAILED. Check Replit Status.');
    }
  }, [isAuthReady, messages, secretKey]);


  // --- SYNC INTERVAL SETUP ---
  useEffect(() => {
    if (isAuthReady) {
      syncWithReplit();
      const intervalId = setInterval(syncWithReplit, SYNC_INTERVAL_MS);
      return () => clearInterval(intervalId);
    }
  }, [isAuthReady, syncWithReplit]);


  // --- SEND MESSAGE HANDLER (Stores plaintext in Firestore) ---
  const handleSendMessage = async () => {
    const text = messageInput.trim();
    if (!text || !dbRef.current || !isAuthReady) return;


    setIsSending(true);


    try {
      const chatCollectionRef = collection(dbRef.current, `/artifacts/${__app_id}/public/data/${COLLECTION_PATH_ROOT}`);
      
      const newMessage = {
          text: text, // Stored as PLAINTEXT for our local history integrity
          room: 'Room B (Gemini)',
          userId: userId,
          timestamp: serverTimestamp()
      };


      await addDoc(chatCollectionRef, newMessage);
      setMessageInput('');
      
    } catch (e) {
      console.error("Error adding document: ", e);
    } finally {
      setIsSending(false);
    }
  };


  // --- RENDERING LOGIC ---
  const renderContent = () => {
    switch (activeTab) {
      case 'Chat':
        return <ChatDisplay messages={messages} />;
      case 'Encryption':
        return (
          <EncryptionModule 
            secretKey={secretKey} 
            setSecretKey={setSecretKey} 
            isE2E={!!secretKey}
          />
        );
      case 'Monitor':
        return (
          <div className="p-4 bg-white rounded-xl shadow-md">
            <h3 className="text-lg font-semibold flex items-center text-gray-800">
              <Zap className="w-5 h-5 mr-2 text-indigo-600" />
              ACE Monitor Dashboard 📊 (Coming Soon)
            </h3>
            <p className="text-gray-600 mt-2">
              Current Sync Status: <span className="font-mono text-sm">{syncStatus}</span>
            </p>
          </div>
        );
      case 'Logger':
        return (
          <div className="p-4 bg-white rounded-xl shadow-md">
            <h3 className="text-lg font-semibold flex items-center text-gray-800">
              <Download className="w-5 h-5 mr-2 text-indigo-600" />
              ACE Message Logger 📝 (Coming Soon)
            </h3>
          </div>
        );
      case 'Control':
        return (
          <div className="p-4 bg-white rounded-xl shadow-md">
            <h3 className="text-lg font-semibold flex items-center text-gray-800">
              <Settings className="w-5 h-5 mr-2 text-indigo-600" />
              ACE Control Panel ⚙️ (Coming Soon)
            </h3>
          </div>
        );
      default:
        return null;
    }
  };


  const navItems = [
    { name: 'Chat', icon: MessageCircle },
    { name: 'Encryption', icon: Key },
    { name: 'Monitor', icon: Zap },
    { name: 'Logger', icon: Download },
    { name: 'Control', icon: Settings },
  ];


  return (
    <div className="w-full max-w-4xl mx-auto bg-gray-100 min-h-screen p-4 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
      
      {/* Sidebar Navigation */}
      <div className="w-full sm:w-48 bg-white p-4 rounded-xl shadow-lg flex sm:flex-col flex-row overflow-x-auto sm:overflow-x-visible space-x-2 sm:space-x-0 sm:space-y-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.name;
          return (
            <button
              key={item.name}
              onClick={() => setActiveTab(item.name)}
              className={`p-3 rounded-xl flex items-center justify-center sm:justify-start font-medium transition duration-150 whitespace-nowrap
                ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-700 hover:bg-indigo-50'}
              `}
              aria-label={item.name}
            >
              <Icon className="w-5 h-5 mr-0 sm:mr-2" />
              <span className="hidden sm:inline">{item.name}</span>
            </button>
          );
        })}
      </div>


      {/* Main Content Area */}
      <div className="flex-grow bg-white shadow-xl rounded-2xl flex flex-col h-[85vh]">
        
        {/* Header */}
        <header className="bg-indigo-600 text-white p-4 rounded-t-2xl shadow-md flex justify-between items-center">
            <div>
                <h1 className="text-xl font-bold">ACE Room B: {activeTab}</h1>
                <p className="text-sm opacity-90 truncate mt-1">
                    <LogIn className="w-4 h-4 inline mr-1" />
                    User ID: {userId.substring(0, 8)}...
                </p>
            </div>
            <div className="text-right">
                <p className={`text-xs p-1 rounded font-medium ${syncStatus.includes('SUCCESS') ? 'bg-green-500' : 'bg-yellow-500'}`}>
                    {syncStatus}
                </p>
            </div>
        </header>


        {/* Dynamic Content Area (Chat/Modules) */}
        <div className="flex-grow overflow-hidden">
            {activeTab === 'Chat' ? (
                 <ChatDisplay messages={messages} />
            ) : (
                <div className="p-4 h-full overflow-y-auto">
                    {renderContent()}
                </div>
            )}
        </div>


        {/* Input Area (Only for Chat Tab) */}
        {activeTab === 'Chat' && (
          <div className="p-4 border-t border-gray-200 flex space-x-2">
            <input
              type="text"
              id="message-input"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={secretKey ? "Sending message securely (E2EE Active)..." : "Sending message in plaintext..."}
              className="flex-grow p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              onKeyDown={(e) => {
                if(e.key === 'Enter') handleSendMessage();
              }}
              disabled={!isAuthReady || isSending}
            />
            <button
              onClick={handleSendMessage}
              className={`text-white p-3 rounded-lg font-semibold shadow-md transition duration-150
                ${isAuthReady && !isSending ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-indigo-300 cursor-not-allowed'}
              `}
              disabled={!isAuthReady || isSending}
            >
              {isSending ? 'Sending...' : 'Send'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


export default App;

// 1. Setup & Golden Earth Styling
const canvas = document.getElementById('sketchCanvas');
const ctx = canvas.getContext('2d');
const posDisplay = document.getElementById('pos-display');
const offsetDisplay = document.querySelector('.card:nth-child(2) p');

canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;
ctx.strokeStyle = '#f3e2a0'; 
ctx.lineWidth = 2;

// 2. Origin & Safety Reset
let startX = canvas.width / 2;
let startY = canvas.height / 2;
let x = startX;
let y = startY;

ctx.beginPath();
ctx.moveTo(x, y);

// 3. The Surveyor Math Engine
function updateDisplay(curX, curY) {
    const displayX = ((curX - startX) / 10).toFixed(2);
    const displayY = ((startY - curY) / 10).toFixed(2);
    posDisplay.innerText = `X: ${displayX}, Y: ${displayY}`;

    const dist = Math.sqrt(Math.pow(curX - startX, 2) + Math.pow(curY - startY, 2));
    offsetDisplay.innerText = `Offset: ${(dist / 10).toFixed(2)} ft`;
}

// 4. Desktop Controls (Arrow Keys) with Boundaries
window.addEventListener('keydown', (e) => {
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
    if (keys.includes(e.key)) e.preventDefault(); 

    const step = 10; 
    
    if (e.key === 'ArrowUp' && y > 0) y -= step;
    if (e.key === 'ArrowDown' && y < canvas.height) y += step;
    if (e.key === 'ArrowLeft' && x > 0) x -= step;
    if (e.key === 'ArrowRight' && x < canvas.width) x += step;
    
    if (e.key === ' ') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        x = startX; y = startY;
        ctx.beginPath(); ctx.moveTo(x, y);
        updateDisplay(x, y);
        return;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    updateDisplay(x, y);
});

// 5. Mobile/Touch Controls
canvas.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    x = touch.clientX - canvas.offsetLeft;
    y = touch.clientY - canvas.offsetTop;
    
    // Boundary check for touch
    if (x < 0) x = 0; if (x > canvas.width) x = canvas.width;
    if (y < 0) y = 0; if (y > canvas.height) y = canvas.height;

    ctx.lineTo(x, y);
    ctx.stroke();
    updateDisplay(x, y);
    e.preventDefault();
}, { passive: false });
