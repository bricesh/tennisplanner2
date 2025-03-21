// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCrihIiSCa0Iz9ilZtoYszHWIqduhtOVXY",
  authDomain: "tcr-planner.firebaseapp.com",
  projectId: "tcr-planner",
  databaseURL: "https://tcr-planner-default-rtdb.europe-west1.firebasedatabase.app/",
  storageBucket: "tcr-planner.appspot.com",
  messagingSenderId: "864475814364",
  appId: "1:864475814364:web:f72cad67f081a7b5f69719",
  measurementId: "G-G0Z4LM8K97"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// Application state
let currentUser = null;
let teamId = null;
let teamName = null;
let slots = null;
let sessionDate = null;
let schedule = null;

// DOM elements
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const tabButtons = document.querySelectorAll('.tab-btn');
const authForms = document.querySelectorAll('.auth-form');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const unregisterBtn = document.getElementById('unregister-btn');
const welcomeMessage = document.getElementById('welcome-message');
const sessionInfo = document.getElementById('session-info');
const slotsContainer = document.getElementById('slots-container');
const playersContainer = document.getElementById('players-container');
const loginError = document.getElementById('login-error');
const signupError = document.getElementById('signup-error');

// Get URL parameters
function getUrlParameter(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// Set URL parameters
function setUrlParameters(params) {
  const url = new URL(window.location.href);
  Object.keys(params).forEach(key => {
    url.searchParams.set(key, params[key]);
  });
  window.history.pushState({}, '', url);
}

// Tab switching
tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const targetId = button.getAttribute('data-target');
    
    // Update active tab
    tabButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    // Show corresponding form
    authForms.forEach(form => {
      form.classList.remove('active');
      if (form.id === targetId) {
        form.classList.add('active');
      }
    });
  });
});

// Login form submit
loginBtn.addEventListener('click', () => {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  
  if (!email || !password) {
    loginError.textContent = 'Please fill in all fields';
    return;
  }
  
  auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => {
      // Login successful
      const user = userCredential.user;
      loginError.textContent = '';
      setUrlParameters({ team: teamId, id: user.uid });
      
      // Force page reload to apply new URL parameters
      setTimeout(() => {
        window.location.reload();
      }, 100);
    })
    .catch(error => {
      loginError.textContent = 'Incorrect email or password';
      console.error('Login error:', error);
    });
});

// Signup form submit
signupBtn.addEventListener('click', () => {
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const username = document.getElementById('signup-username').value.trim();
  
  if (!email || !password || !username) {
    signupError.textContent = 'Please fill in all fields';
    return;
  }
  
  auth.createUserWithEmailAndPassword(email, password)
    .then(userCredential => {
      // Signup successful
      const user = userCredential.user;
      signupError.textContent = '';
      
      // Store the username
      database.ref(user.uid).child('username').set(username)
        .then(() => {
          setUrlParameters({ team: teamId, id: user.uid });
          
          // Force page reload to apply new URL parameters
          setTimeout(() => {
            window.location.reload();
          }, 100);
        })
        .catch(error => {
          console.error('Error storing username:', error);
        });
    })
    .catch(error => {
      if (error.code === 'auth/email-already-in-use') {
        signupError.textContent = 'User already registered';
      } else {
        signupError.textContent = 'Error creating account';
      }
      console.error('Signup error:', error);
    });
});

// Logout
logoutBtn.addEventListener('click', () => {
  auth.signOut()
    .then(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete('id');
      window.history.pushState({}, '', url);
      showAuthContainer();
    })
    .catch(error => {
      console.error('Logout error:', error);
    });
});

// Unregister from all slots
unregisterBtn.addEventListener('click', () => {
  unregisterUser(currentUser.uid)
    .then(() => {
      displaySuccessMessage('Successfully unregistered');
      loadSchedule();
    })
    .catch(error => {
      console.error('Unregister error:', error);
    });
});

// Get the next session date (next Friday)
function getNextSessionDate() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 5 = Friday
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  const nextFriday = new Date(today);
  nextFriday.setDate(today.getDate() + daysUntilFriday);
  return nextFriday;
}

// Format date to YYYY-MM-DD
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format date for display
function formatDateForDisplay(date) {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString(undefined, options);
}



// Register user for a slot
function registerUser(userId, slot) {
  return database.ref(`schedule/${formatDate(sessionDate)}/${teamId}/${slot}/${userId}`).set(true);
}

// Unregister user from all slots
function unregisterUser(userId) {
  const promises = [];
  if (slots) {
    Object.keys(slots).forEach(slot => {
      promises.push(database.ref(`schedule/${formatDate(sessionDate)}/${teamId}/${slot}/${userId}`).set(false));
    });
  }
  return Promise.all(promises);
}

// Display success message
function displaySuccessMessage(message) {
  const successBox = document.createElement('div');
  successBox.classList.add('success-box');
  successBox.textContent = message;
  appContainer.insertBefore(successBox, appContainer.firstChild);
  
  // Remove after 3 seconds
  setTimeout(() => {
    successBox.remove();
  }, 3000);
}

// Load team config
function loadTeamConfig() {
  return database.ref('config').once('value')
    .then(snapshot => {
      const config = snapshot.val();
      
      if (!config) {
        throw new Error('Failed to load config');
      }
      
      const saison = config.saison;
      teamName = config.teams[teamId].name;
      slots = config.teams[teamId].slots;
      
      return config;
    });
}

// Load user data
function loadUserData(userId) {
  return database.ref(userId).child('username').once('value')
    .then(snapshot => {
      return snapshot.val();
    });
}

// Load schedule
function loadSchedule() {
  const sessionDateStr = formatDate(sessionDate);
  return database.ref(`schedule/${sessionDateStr}/${teamId}`).once('value')
    .then(snapshot => {
      schedule = snapshot.val() || {};
      renderSlots();
      return schedule;
    });
}

// Set up real-time schedule updates
function setupRealTimeUpdates() {
  const sessionDateStr = formatDate(sessionDate);
  database.ref(`schedule/${sessionDateStr}/${teamId}`).on('value', snapshot => {
    schedule = snapshot.val() || {};
    renderSlots();
  });
}

// Initialize player lists structure (called once)
function initializePlayerLists() {
  playersContainer.innerHTML = '';
  
  // Create player lists in fixed order
  Object.entries(slots).forEach(([slotName, maxPlayers]) => {
    const playerListElement = document.createElement('div');
    playerListElement.className = 'player-list';
    playerListElement.id = `player-list-${slotName}`;
    
    const slotTitle = document.createElement('h3');
    slotTitle.textContent = `${slotName} Slot`;
    playerListElement.appendChild(slotTitle);
    
    const playerList = document.createElement('ul');
    playerList.id = `players-${slotName}`;
    playerListElement.appendChild(playerList);
    
    playersContainer.appendChild(playerListElement);
  });
}

// Update player lists content
function updatePlayerLists() {
  Object.entries(slots).forEach(([slotName, maxPlayers]) => {
    const playerList = document.getElementById(`players-${slotName}`);
    if (!playerList) return;
    
    // Clear existing list
    playerList.innerHTML = '';
    
    const slotData = schedule[slotName] || {};
    const registeredPlayers = Object.entries(slotData)
      .filter(([_, isRegistered]) => isRegistered === true)
      .map(([playerId]) => playerId);
    
    // Add loading indicator
    const loadingItem = document.createElement('li');
    loadingItem.textContent = 'Loading players...';
    loadingItem.style.fontStyle = 'italic';
    playerList.appendChild(loadingItem);
    
    // Load registered player usernames
    const playerPromises = registeredPlayers.map(playerId => {
      return loadUserData(playerId);
    });
    
    Promise.all(playerPromises).then(usernames => {
      // Clear loading indicator
      playerList.innerHTML = '';
      
      if (usernames.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.textContent = 'No players registered yet';
        emptyItem.style.fontStyle = 'italic';
        playerList.appendChild(emptyItem);
      } else {
        usernames.forEach(username => {
          const playerItem = document.createElement('li');
          playerItem.textContent = username;
          playerList.appendChild(playerItem);
        });
      }
    });
  });
}

// Render slot buttons
function renderSlotButtons() {
  slotsContainer.innerHTML = '';
  
  Object.entries(slots).forEach(([slotName, maxPlayers]) => {
    const slotData = schedule[slotName] || {};
    const registeredPlayers = Object.entries(slotData)
      .filter(([_, isRegistered]) => isRegistered === true)
      .map(([playerId]) => playerId);
    
    // If slot is full
    if (registeredPlayers.length >= maxPlayers) {
      const warningBox = document.createElement('div');
      warningBox.className = 'warning-box';
      warningBox.textContent = `${slotName} slot full!`;
      slotsContainer.appendChild(warningBox);
    } else {
      // Create slot button
      const slotButton = document.createElement('button');
      slotButton.className = 'slot-btn';
      slotButton.textContent = `${slotName} slot (${registeredPlayers.length}/${maxPlayers} players)`;
      slotButton.addEventListener('click', () => {
        unregisterUser(currentUser.uid)
          .then(() => registerUser(currentUser.uid, slotName))
          .then(() => {
            loadSchedule();
            displaySuccessMessage(`Registered for ${slotName} slot`);
          })
          .catch(error => {
            console.error('Registration error:', error);
          });
      });
      slotsContainer.appendChild(slotButton);
    }
  });
}

// Render slots and players
function renderSlots() {
  // First time, create the player lists structure
  if (!document.getElementById(`player-list-${Object.keys(slots)[0]}`)) {
    initializePlayerLists();
  }
  
  // Update slot buttons
  renderSlotButtons();
  
  // Update player lists content without changing structure
  updatePlayerLists();
}

// Show auth container
function showAuthContainer() {
  authContainer.style.display = 'block';
  appContainer.classList.add('hidden');
}

// Show app container
function showAppContainer() {
  authContainer.style.display = 'none';
  appContainer.classList.remove('hidden');
}

// Initialize app
function initApp() {
  teamId = getUrlParameter('team');
  const userId = getUrlParameter('id');
  
  if (!teamId) {
    // No team ID provided
    document.body.innerHTML = '<div class="container"><h1>Error</h1><p class="error-message">Incorrect URL: Missing team parameter</p></div>';
    return;
  }
  
  sessionDate = getNextSessionDate();
  
  if (userId) {
    // User is logged in
    currentUser = { uid: userId };
    
    // Load team config
    loadTeamConfig()
      .then(() => loadUserData(userId))
      .then(username => {
        // Update welcome message
        welcomeMessage.textContent = `Welcome ${username}, ${teamName}`;
        sessionInfo.textContent = `Register for the next session on ${formatDateForDisplay(sessionDate)}`;
        
        // Load schedule and show app container
        return loadSchedule();
      })
      .then(() => {
        showAppContainer();
        setupRealTimeUpdates();
      })
      .catch(error => {
        console.error('Initialization error:', error);
      });
  } else {
    // User needs to log in
    showAuthContainer();
  }
}

// Initialize app when the page loads
document.addEventListener('DOMContentLoaded', initApp);

// Listen for auth state changes
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    const userId = getUrlParameter('id');
    
    if (!userId) {
      setUrlParameters({ team: teamId, id: user.uid });
      initApp();
    }
  }
});