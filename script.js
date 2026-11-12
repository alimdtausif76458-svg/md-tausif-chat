// ======================================
// SUPABASE CONFIGURATION
// ======================================

const SUPABASE_URL = "https://vtsftlbmneolkpebcsyh.supabase.co";
const SUPABASE_KEY = "sb_publishable_pddgLKwmsfBH0i06oaowZw_C2Y_5Dk8";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ======================================
// ROOM SESSION STORAGE
// ======================================

const ROOM_SESSION_KEY = "md_tausif_chat_room";

function saveRoomSession(roomId) {
    try {
        localStorage.setItem(ROOM_SESSION_KEY, roomId);
    } catch (error) {
        console.error("Room session save error:", error);
    }
}

function clearRoomSession() {
    try {
        localStorage.removeItem(ROOM_SESSION_KEY);
    } catch (error) {
        console.error("Room session clear error:", error);
    }
}


// ======================================
// HTML ELEMENTS
// ======================================

const roomSetup = document.getElementById("roomSetup");
const roomSection = document.getElementById("roomSection");

const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomForm = document.getElementById("joinRoomForm");
const inviteCodeInput = document.getElementById("inviteCodeInput");

const roomStatus = document.getElementById("roomStatus");

const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const memberCount = document.getElementById("memberCount");

const roomTimer = document.getElementById("roomTimer");

const copyRoomCodeBtn = document.getElementById("copyRoomCodeBtn");
const leaveRoomBtn = document.getElementById("leaveRoomBtn");

const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const chatArea = document.getElementById("chatArea");
// =====================================
// TELEGRAM STYLE REPLY SYSTEM
// =====================================

let currentReplyMessage = null;


// ======================================
// GLOBAL VARIABLES
// ======================================

let currentUser = null;
let currentRoomId = null;
let currentRoomCode = null;
let currentRoomExpiry = null;

let messageChannel = null;
let memberChannel = null;
let reactionChannel = null;
let presenceChannel = null;
let receiptChannel = null;

let typingStopTimer = null;
let onlineUserIds = new Set();

let presenceStatusElement = null;
let typingIndicatorElement = null;

let expiryTimer = null;
let memberRefreshTimer = null;
let serverExpiryCheckTimer = null;

let isRoomEnding = false;

const displayedMessageIds = new Set();

let reactionsByMessage = new Map();

let messageReadObserver = null;

const messageDataById = new Map();

const deliveredReceiptPromises = new Map();

const readReceiptPending = new Set();


// ======================================
// TELEGRAM STYLE MESSAGE SOUNDS
// ======================================

let messageAudioContext = null;


// ======================================
// MOBILE PLAY LUDO BUTTON
// ======================================

const mobilePlayLudoBtn = document.getElementById("mobilePlayLudoBtn");
const openLudoBtn = document.getElementById("openLudoBtn");

if (mobilePlayLudoBtn) {

    mobilePlayLudoBtn.addEventListener("click", function () {

        // Existing Ludo button ko trigger karo
        if (openLudoBtn) {
            openLudoBtn.click();
        }

        // Sidebar band karo
        const mobileMenu = document.querySelector(".mobile-menu");

        if (mobileMenu) {
            mobileMenu.classList.remove("is-open");
        }

        const menuToggle = document.querySelector(".mobile-menu-toggle");

        if (menuToggle) {
            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.setAttribute("aria-label", "Open navigation menu");
        }

    });

}

let messageSoundsEnabled =
    localStorage.getItem("messageSoundsEnabled") !== "false";

function unlockMessageAudio() {

    if (!messageAudioContext) {
        const AudioContext =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContext) return;

        messageAudioContext = new AudioContext();
    }

    if (messageAudioContext.state === "suspended") {
        messageAudioContext.resume();
    }
}

// First user interaction par audio unlock
document.addEventListener(
    "pointerdown",
    unlockMessageAudio,
    { once: true }
);

document.addEventListener(
    "keydown",
    unlockMessageAudio,
    { once: true }
);


function playMessageSound(type) {
    if (!messageSoundsEnabled) return;

    if (
        !messageAudioContext ||
        messageAudioContext.state !== "running"
    ) return;

    const ctx = messageAudioContext;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.type = "sine";

    // Send aur receive ki alag tones
    oscillator.frequency.value =
        type === "send" ? 880 : 660;

    const now = ctx.currentTime;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    oscillator.start(now);
    oscillator.stop(now + 0.17);
}


// =====================================
// TELEGRAM REPLY PREVIEW FUNCTIONS
// =====================================

function setReplyMessage(message) {

    if (!message || !message.id) return;

    currentReplyMessage = message;

    const preview = document.getElementById("replyPreview");
    const previewName = document.getElementById("replyPreviewName");
    const previewText = document.getElementById("replyPreviewText");
    const messageInput = document.getElementById("messageInput");

    if (!preview || !previewName || !previewText) return;

    const isOwnMessage =
        currentUser && message.sender_id === currentUser.id;

    previewName.textContent = isOwnMessage
        ? "You"
        : (message.sender_name || "Reply");

    previewText.textContent = message.message || "";

    preview.hidden = false;

    if (messageInput) {
        messageInput.focus();
    }
}

function cancelReplyMessage() {

    currentReplyMessage = null;

    const preview = document.getElementById("replyPreview");

    if (preview) {
        preview.hidden = true;
    }
}

// Cancel button
document.getElementById("cancelReplyBtn")?.addEventListener("click", cancelReplyMessage);
// ======================================
// READ RECEIPT CSS
// ======================================

function injectReceiptStyles() {

    if (document.getElementById("receiptStyles")) return;

    const style = document.createElement("style");

    style.id = "receiptStyles";

    style.textContent = `
        .message-footer {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 4px;
            width: 100%;
            margin-top: 5px;
        }

        .message-time {
            position: static !important;
            display: inline-block;
            margin: 0;
            padding: 0;
            font-size: 10px;
            line-height: 1;
            white-space: nowrap;
        }

        .message-tick {
            position: static !important;
            display: inline-block;
            margin: 0;
            padding: 0;
            font-size: 12px;
            line-height: 1;
            font-weight: bold;
            letter-spacing: -2px;
            white-space: nowrap;
            color: #9ca3af;
        }

        .message-tick.delivered {
            color: #c0c8d2;
        }

        .message-tick.read {
            color: #38bdf8;
        }
    `;

    document.head.appendChild(style);

}


// ======================================
// EMOJI DATA
// ======================================

const emojiCategories = {

    "Smileys": [
        "😀","😃","😄","😁","😆","😅","😂","🤣",
        "😊","😇","🙂","🙃","😉","😍","🥰","😘",
        "😗","😙","😚","😋","😛","😜","🤪","😝",
        "🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐",
        "😑","😶","😏","😒","🙄","😬","🤥","😔",
        "😪","🤤","😴","😷","🤒","🤕","🤢","🤮",
        "🥵","🥶","🥴","😵","🤯","🤠","🥳","😎",
        "🤓","🧐","😕","😟","🙁","☹️","😮","😯",
        "😲","😳","🥺","😦","😧","😨","😰","😥",
        "😢","😭","😱","😖","😣","😞","😓","😩",
        "😫","🥱","😤","😡","😠","🤬","💀","👻"
    ],

    "Hands": [
        "👋","🤚","🖐️","✋","🖖","👌","🤌","🤏",
        "✌️","🤞","🫰","🤟","🤘","🤙","👈","👉",
        "👆","👇","☝️","👍","👎","✊","👊","🤛",
        "🤜","👏","🙌","👐","🤲","🙏","✍️","💪"
    ],

    "Hearts": [
        "❤️","🧡","💛","💚","💙","💜","🖤","🤍",
        "🤎","🩷","🩵","🩶","💔","❣️","💕","💞",
        "💓","💗","💖","💘","💝","💟","♥️","❤️‍🔥"
    ],

    "Animals": [
        "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼",
        "🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔",
        "🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺",
        "🐗","🐴","🦄","🐝","🦋","🐌","🐞","🐢",
        "🐍","🦎","🦖","🐙","🦑","🦀","🐬","🐳"
    ],

    "Food": [
        "🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓",
        "🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝",
        "🍅","🥑","🥦","🥕","🌽","🌶️","🍕","🍔",
        "🍟","🌭","🍿","🧂","🥪","🌮","🌯","🍜",
        "🍝","🍣","🍱","🍰","🎂","🍩","🍪","🍫",
        "🍬","🍭","☕","🧋","🥤","🧃","🍹","🥛"
    ],

    "Activities": [
        "⚽","🏀","🏈","⚾","🎾","🏐","🏉","🎱",
        "🏓","🏸","🥊","🥋","🎯","🎮","🎲","🧩",
        "🎨","🎭","🎤","🎧","🎼","🎹","🥁","🎸",
        "🏆","🥇","🥈","🥉","🎁","🎉","🎊","🎈"
    ],

    "Objects": [
        "💡","📱","💻","⌚","📷","📹","🔋","💰",
        "💎","🔑","🔒","🔓","🔔","📢","📣","📌",
        "✏️","📝","📚","📖","📦","✉️","📩","📅",
        "⚡","🔥","🌟","⭐","✨","☀️","🌙","☁️",
        "🌈","☔","❄️","💧","🎵","🎶","🚀","🛸"
    ]

};


// ======================================
// CREATE EMOJI PICKER
// ======================================

let emojiPickerPanel = null;
let emojiPickerButton = null;

function createEmojiPicker() {

    if (!messageForm || !messageInput) return;

    emojiPickerButton = document.createElement("button");

    emojiPickerButton.type = "button";
    emojiPickerButton.id = "emojiPickerBtn";
    emojiPickerButton.className = "emoji-picker-button";
    emojiPickerButton.textContent = "😊";
    emojiPickerButton.title = "Choose emoji";

    messageForm.insertBefore(
        emojiPickerButton,
        messageInput
    );

    emojiPickerPanel = document.createElement("div");

    emojiPickerPanel.id = "emojiPickerPanel";
    emojiPickerPanel.className = "emoji-picker-panel";
    emojiPickerPanel.hidden = true;

    const search = document.createElement("input");

    search.type = "text";
    search.placeholder = "Search emoji...";
    search.className = "emoji-search";

    emojiPickerPanel.appendChild(search);

    const categoryContainer = document.createElement("div");

    categoryContainer.className = "emoji-categories";

    const emojiGrid = document.createElement("div");

    emojiGrid.className = "emoji-grid";

    emojiPickerPanel.appendChild(categoryContainer);
    emojiPickerPanel.appendChild(emojiGrid);

    document.body.appendChild(emojiPickerPanel);

    let activeCategory = "Smileys";

    function renderEmojis(category, searchTerm = "") {

        emojiGrid.innerHTML = "";

        let emojis = [];

        if (category === "Search") {

            Object.values(emojiCategories).forEach(list => {
                emojis.push(...list);
            });

            if (!searchTerm.trim()) {
                emojis = [];
            }

        } else {

            emojis = emojiCategories[category] || [];

        }

        emojis.forEach(emoji => {

            const button = document.createElement("button");

            button.type = "button";
            button.className = "emoji-option";
            button.textContent = emoji;
            button.title = emoji;

            button.addEventListener("click", function () {

                insertEmoji(emoji);
                closeEmojiPicker();

            });

            emojiGrid.appendChild(button);

        });

        if (emojis.length === 0) {

            const empty = document.createElement("div");

            empty.className = "emoji-empty";
            empty.textContent = "No emojis found";

            emojiGrid.appendChild(empty);

        }

    }

    Object.keys(emojiCategories).forEach(category => {

        const button = document.createElement("button");

        button.type = "button";
        button.className = "emoji-category-button";
        button.textContent = category;

        if (category === activeCategory) {
            button.classList.add("active");
        }

        button.addEventListener("click", function () {

            activeCategory = category;
            search.value = "";

            categoryContainer
                .querySelectorAll("button")
                .forEach(item => item.classList.remove("active"));

            button.classList.add("active");

            renderEmojis(category);

        });

        categoryContainer.appendChild(button);

    });

    search.addEventListener("input", function () {

        const term = search.value.trim();

        categoryContainer
            .querySelectorAll("button")
            .forEach(item => item.classList.remove("active"));

        renderEmojis("Search", term);

    });

    emojiPickerButton.addEventListener("click", function (event) {

        event.stopPropagation();

        if (emojiPickerPanel.hidden) {
            openEmojiPicker();
        } else {
            closeEmojiPicker();
        }

    });

    document.addEventListener("click", function (event) {

        if (
            !emojiPickerPanel.contains(event.target) &&
            !emojiPickerButton.contains(event.target)
        ) {
            closeEmojiPicker();
        }

    });

    renderEmojis("Smileys");

}


function insertEmoji(emoji) {

    const start = messageInput.selectionStart;
    const end = messageInput.selectionEnd;
    const value = messageInput.value;

    messageInput.value =
        value.substring(0, start) +
        emoji +
        value.substring(end);

    const cursorPosition = start + emoji.length;

    messageInput.focus();

    messageInput.setSelectionRange(
        cursorPosition,
        cursorPosition
    );

}


function openEmojiPicker() {

    if (!emojiPickerPanel) return;

    const rect = emojiPickerButton.getBoundingClientRect();

    emojiPickerPanel.hidden = false;

    const panelWidth = Math.min(320, window.innerWidth - 20);

    let left = rect.left;

    if (left + panelWidth > window.innerWidth - 10) {
        left = window.innerWidth - panelWidth - 10;
    }

    let top = rect.top - 350;

    if (top < 10) {
        top = rect.bottom + 10;
    }

    emojiPickerPanel.style.width = panelWidth + "px";
    emojiPickerPanel.style.left = Math.max(10, left) + "px";
    emojiPickerPanel.style.top = top + "px";

}


function closeEmojiPicker() {

    if (emojiPickerPanel) {
        emojiPickerPanel.hidden = true;
    }

}


// ======================================
// AUTHENTICATION
// ======================================

async function initializeAuth() {

    roomStatus.textContent = "Connecting...";

    try {

        const { data: sessionData, error: sessionError } =
            await supabaseClient.auth.getSession();

        if (sessionError) throw sessionError;

        if (sessionData.session) {

            currentUser = sessionData.session.user;

        } else {

            const { data, error } =
                await supabaseClient.auth.signInAnonymously();

            if (error) throw error;

            currentUser = data.user;

        }

        roomStatus.textContent = "";

        console.log("Authentication successful:", currentUser.id);

        await restoreSavedRoom();

    } catch (error) {

        console.error("Authentication error:", error);

        roomStatus.textContent =
            "Connection failed: " + error.message;

    }

}


// ======================================
// RESTORE SAVED ROOM
// ======================================

async function restoreSavedRoom() {

    let savedRoomId;

    try {

        savedRoomId = localStorage.getItem(ROOM_SESSION_KEY);

    } catch (error) {

        console.error("Room session read error:", error);

        return;

    }

    if (!savedRoomId) return;

    roomStatus.textContent = "Restoring your previous room...";

    try {

        const { data: roomData, error: roomError } =
            await supabaseClient
                .from("chat_rooms")
                .select("id, invite_code, expires_at")
                .eq("id", savedRoomId)
                .maybeSingle();

        if (roomError) throw roomError;

        if (!roomData) {

            clearRoomSession();

            roomStatus.textContent =
                "Your previous room is no longer available.";

            return;

        }

        if (
            !roomData.expires_at ||
            new Date(roomData.expires_at).getTime() <= Date.now()
        ) {

            clearRoomSession();

            roomStatus.textContent =
                "Your previous room has expired.";

            return;

        }

        await openRoom(
            roomData.id,
            roomData.invite_code
        );

    } catch (error) {

        console.error("Room restoration error:", error);

        roomStatus.textContent =
            "Unable to restore previous room. Please refresh again.";

    }

}


// ======================================
// CREATE ROOM
// ======================================

createRoomBtn.addEventListener("click", async function () {

    if (!currentUser) {
        alert("Please wait. Connecting to server...");
        return;
    }

    createRoomBtn.disabled = true;
    roomStatus.textContent = "Creating room...";

    try {

        const { data, error } = await supabaseClient
            .rpc("create_chat_room");

        if (error) throw error;

        const room = Array.isArray(data) ? data[0] : data;

        if (!room || !room.room_id || !room.invite_code) {
            throw new Error("Invalid room information received.");
        }

        await openRoom(room.room_id, room.invite_code);

    } catch (error) {

        console.error("Room creation error:", error);

        roomStatus.textContent =
            "Room creation failed: " + error.message;

    } finally {

        createRoomBtn.disabled = false;

    }

});


// ======================================
// JOIN ROOM
// ======================================

joinRoomForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    if (!currentUser) {
        alert("Please wait. Connecting to server...");
        return;
    }

    const inviteCode = inviteCodeInput.value.trim().toUpperCase();

    if (!inviteCode) return;

    const joinButton = joinRoomForm.querySelector("button");

    joinButton.disabled = true;
    roomStatus.textContent = "Joining room...";

    try {

        const { data, error } = await supabaseClient
            .rpc("join_chat_room", {
                p_invite_code: inviteCode
            });

        if (error) throw error;

        await openRoom(data, inviteCode);

    } catch (error) {

        console.error("Room joining error:", error);

        if (error.message.includes("Room is full")) {

            roomStatus.textContent =
                "Room is full. Maximum 10 members allowed.";

        } else if (error.message.includes("Room time max reached")) {

            roomStatus.textContent =
                "Room time max reached. This room has expired.";

        } else {

            roomStatus.textContent =
                "Unable to join room. Check Room ID.";

        }

    } finally {

        joinButton.disabled = false;

    }

});


// ======================================
// OPEN ROOM
// ======================================

async function openRoom(roomId, roomCode) {

    const { data: roomData, error: roomError } = await supabaseClient
        .from("chat_rooms")
        .select("expires_at")
        .eq("id", roomId)
        .single();

    if (roomError) {
        throw new Error(
            "Room expiry information unavailable: " + roomError.message
        );
    }

    if (!roomData || !roomData.expires_at) {
        throw new Error("Room expiry information missing.");
    }

    currentRoomExpiry = new Date(roomData.expires_at);

    if (currentRoomExpiry.getTime() <= Date.now()) {

        clearRoomSession();

        roomStatus.textContent =
            "Room time max reached. This room has expired.";

        return;

    }

    currentRoomId = roomId;
    currentRoomCode = roomCode;

    if (mobilePlayLudoBtn) {
    mobilePlayLudoBtn.hidden = false;
}

    saveRoomSession(roomId);

    isRoomEnding = false;

    roomSetup.hidden = true;
    roomSection.hidden = false;

    requestAnimationFrame(() => {

        setTimeout(() => {

            if (currentRoomId !== roomId || isRoomEnding) return;

            roomSection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        }, 300);

    });

    roomCodeDisplay.textContent = roomCode;

    displayedMessageIds.clear();
    reactionsByMessage.clear();

    messageDataById.clear();
    deliveredReceiptPromises.clear();
    readReceiptPending.clear();

    chatArea.innerHTML = "";

    setupMessageReadObserver();

    startExpiryTimer();
    startServerExpiryCheck();

    subscribeToMessages();
    subscribeToMembers();
    subscribeToReactions();
    subscribeToReceipts();

    setupPresenceUI();
    subscribeToPresence();

    await loadMessages();

    if (currentRoomId !== roomId || isRoomEnding) return;

    await loadAllReactions();

    if (currentRoomId !== roomId || isRoomEnding) return;

    await loadAllOwnMessageReceiptStatuses();

    if (currentRoomId !== roomId || isRoomEnding) return;

    await updateMemberCount();

    if (currentRoomId !== roomId || isRoomEnding) return;

    clearInterval(memberRefreshTimer);

    memberRefreshTimer = setInterval(function () {

        if (currentRoomId && !isRoomEnding) {
            updateMemberCount();
        }

    }, 15000);

}


// ======================================
// ROOM EXPIRY TIMER
// ======================================

function startExpiryTimer() {

    clearInterval(expiryTimer);

    function checkExpiry() {

        if (!currentRoomExpiry || isRoomEnding) return;

        const remainingTime =
            currentRoomExpiry.getTime() - Date.now();

        if (remainingTime <= 0) {

            roomTimer.textContent = "Time Left: 00:00";

            expireCurrentRoom();

            return;

        }

        const minutes = Math.floor(remainingTime / 60000);

        const seconds = Math.floor(
            (remainingTime % 60000) / 1000
        );

        const formattedTime =
            String(minutes).padStart(2, "0") + ":" +
            String(seconds).padStart(2, "0");

        roomTimer.textContent = "Time Left: " + formattedTime;

        roomTimer.classList.toggle(
            "urgent",
            remainingTime <= 5 * 60 * 1000
        );

    }

    checkExpiry();

    expiryTimer = setInterval(checkExpiry, 1000);

}


// ======================================
// SERVER-SIDE EXPIRY VERIFICATION
// ======================================

function startServerExpiryCheck() {

    clearInterval(serverExpiryCheckTimer);

    async function verifyRoom() {

        if (!currentRoomId || isRoomEnding) return;

        const roomId = currentRoomId;

        try {

            const { data, error } = await supabaseClient
                .from("chat_rooms")
                .select("id")
                .eq("id", roomId)
                .maybeSingle();

            if (error) {

                console.error("Server expiry check error:", error);

                return;

            }

            if (!data && currentRoomId === roomId) {
                expireCurrentRoom();
            }

        } catch (error) {

            console.error("Expiry verification failed:", error);

        }

    }

    verifyRoom();

    serverExpiryCheckTimer = setInterval(verifyRoom, 10000);

}


// ======================================
// REMOVE ALL ROOM CHANNELS
// ======================================

async function removeRoomChannels() {

    const channels = [
        messageChannel,
        memberChannel,
        reactionChannel,
        presenceChannel,
        receiptChannel
    ];

    for (const channel of channels) {

        if (channel) {
            await supabaseClient.removeChannel(channel);
        }

    }

    messageChannel = null;
    memberChannel = null;
    reactionChannel = null;
    presenceChannel = null;
    receiptChannel = null;

    if (messageReadObserver) {
        messageReadObserver.disconnect();
        messageReadObserver = null;
    }

    clearTimeout(typingStopTimer);

    onlineUserIds.clear();

    if (presenceStatusElement) presenceStatusElement.remove();
    if (typingIndicatorElement) typingIndicatorElement.remove();

    presenceStatusElement = null;
    typingIndicatorElement = null;

}


// ======================================
// ROOM EXPIRED
// ======================================

function expireCurrentRoom() {

    if (isRoomEnding) return;

    isRoomEnding = true;
    if (mobilePlayLudoBtn) {
    mobilePlayLudoBtn.hidden = true;
}

    clearRoomSession();

    clearInterval(expiryTimer);
    clearInterval(memberRefreshTimer);
    clearInterval(serverExpiryCheckTimer);

    messageInput.disabled = true;

    const sendBtn = document.getElementById("sendBtn");

    if (sendBtn) sendBtn.disabled = true;

    if (emojiPickerButton) emojiPickerButton.disabled = true;

    leaveRoomBtn.disabled = true;

    closeEmojiPicker();

    chatArea.innerHTML = "";

    const notice = document.createElement("div");

    notice.className = "welcome-message";

    notice.textContent =
        "Room time max reached. This room has expired. Returning to homepage...";

    chatArea.appendChild(notice);

    removeRoomChannels();

    if (window.destroyLudo) {
        window.destroyLudo().catch(error => {
            console.error("Ludo cleanup error:", error);
        });
    }

    currentRoomId = null;
    currentRoomCode = null;
    currentRoomExpiry = null;

    setTimeout(function () {
        window.location.reload();
    }, 4000);

}


// ======================================
// LOAD MESSAGES
// ======================================

async function loadMessages() {

    const roomId = currentRoomId;

    const { data, error } = await supabaseClient
        .from("room_messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(100);

    if (currentRoomId !== roomId || isRoomEnding) return;

    if (error) {

        console.error("Message loading error:", error);

        showWelcome("Unable to load messages.");

        return;

    }

    if (!data || data.length === 0) {

        if (displayedMessageIds.size === 0) {
            showWelcome("Welcome! Start chatting with your friends.");
        }

        return;

    }

    data.forEach(addMessage);

    scrollToBottom();

}


// ======================================
// SHOW WELCOME
// ======================================

function showWelcome(text) {

    if (chatArea.querySelector(".welcome-message")) return;

    const welcome = document.createElement("div");

    welcome.className = "welcome-message";
    welcome.textContent = text;

    chatArea.appendChild(welcome);

}


// ======================================
// FORMAT MESSAGE TIME
// ======================================

function formatMessageTime(dateValue) {

    const date = new Date(dateValue);

    return date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });

}









// =====================================
// TELEGRAM STYLE LEFT SWIPE TO REPLY
// =====================================
// =====================================
// TELEGRAM STYLE LEFT SWIPE TO REPLY
// =====================================

// =====================================
// TELEGRAM STYLE TOUCH SWIPE REPLY
// =====================================
// =====================================
// TELEGRAM STYLE LEFT SWIPE TO REPLY
// =====================================

function attachMessageSwipeReply(bubble, message) {

    let startX = 0;
    let startY = 0;
    let currentX = 0;

    let isSwiping = false;
    let gestureDirection = null;

    const threshold = 65;
    const maxSwipe = 110;

    bubble.style.touchAction = "pan-y";
    bubble.style.willChange = "transform";

    bubble.addEventListener("touchstart", function(e) {

        if (e.touches.length !== 1) return;

        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;

        currentX = 0;
        isSwiping = true;
        gestureDirection = null;

        bubble.style.transition = "none";

    }, { passive: true });


    bubble.addEventListener("touchmove", function(e) {

        if (!isSwiping || e.touches.length !== 1) return;

        const diffX = e.touches[0].clientX - startX;
        const diffY = e.touches[0].clientY - startY;

        // Gesture direction decide karo
        if (!gestureDirection) {

            if (Math.abs(diffX) < 8 && Math.abs(diffY) < 8) {
                return;
            }

            gestureDirection =
                Math.abs(diffX) > Math.abs(diffY)
                    ? "horizontal"
                    : "vertical";

        }

        // Normal vertical scrolling ko allow karo
        if (gestureDirection === "vertical") {
            return;
        }

        // Horizontal browser movement ko roko
        if (e.cancelable) {
            e.preventDefault();
        }

        // Sirf left swipe
        if (diffX < 0) {

            currentX = Math.max(diffX, -maxSwipe);

            bubble.style.transform =
                `translate3d(${currentX}px, 0, 0)`;

        } else {

            currentX = 0;

            bubble.style.transform =
                "translate3d(0, 0, 0)";

        }

    }, { passive: false });


    bubble.addEventListener("touchend", function() {

        if (!isSwiping) return;

        // Swipe complete hone par reply preview kholo
        if (
            gestureDirection === "horizontal" &&
            currentX <= -threshold
        ) {
            setReplyMessage(message);
        }

        // Bubble ko original position par lao
        bubble.style.transition = "transform 0.2s ease";

        bubble.style.transform =
            "translate3d(0, 0, 0)";

        setTimeout(function() {
            bubble.style.transition = "";
        }, 220);

        isSwiping = false;
        currentX = 0;
        gestureDirection = null;

    });


    bubble.addEventListener("touchcancel", function() {

        isSwiping = false;
        currentX = 0;
        gestureDirection = null;

        bubble.style.transition = "transform 0.2s ease";
        bubble.style.transform = "translate3d(0, 0, 0)";

    });

}
// ======================================
// DISPLAY MESSAGE - GLOSSY VERSION
// ======================================

function addMessage(message) {

    if (isRoomEnding) return;

    const messageId = String(message.id);

    if (displayedMessageIds.has(messageId)) return;

    displayedMessageIds.add(messageId);

    messageDataById.set(messageId, message);

    const welcome = chatArea.querySelector(".welcome-message");

    if (welcome) welcome.remove();

    const isOwnMessage =
        message.sender_id === currentUser.id;

    // OUTER MESSAGE

    const messageElement = document.createElement("div");

    messageElement.className = isOwnMessage
        ? "message own"
        : "message received";

    messageElement.dataset.messageId = messageId;

    

    // MESSAGE BUBBLE

    const bubble = document.createElement("div");

/*bubble.className = "message-bubble";
attachMessageSwipeReply(bubble, message);*/

bubble.className = "message-bubble";

// Mobile par bubble tap karne se keyboard ka focus na hate
bubble.addEventListener("pointerdown", function(event) {
    if (event.pointerType === "touch") {
        event.preventDefault();
    }
}, true); 







attachMessageSwipeReply(bubble, message);
    // SENDER

    const sender = document.createElement("strong");

    sender.className = "message-sender";

    sender.textContent = isOwnMessage ? "" : "Member";

    // MESSAGE TEXT

   // REPLY QUOTE

if (message.reply_to_id) {

    const replyQuote = document.createElement("div");

    replyQuote.className = "message-reply-quote";

    replyQuote.dataset.replyTarget = String(message.reply_to_id);

    const quoteName = document.createElement("strong");

    quoteName.className = "reply-quote-name";

    const quoteText = document.createElement("span");

    quoteText.className = "reply-quote-text";

    replyQuote.appendChild(quoteName);
    replyQuote.appendChild(quoteText);

    bubble.appendChild(replyQuote);

    async function loadReplyOriginal() {

        let original = messageDataById.get(
            String(message.reply_to_id)
        );

        if (!original) {

            const { data, error } = await supabaseClient
                .from("room_messages")
                .select("*")
                .eq("id", message.reply_to_id)
                .maybeSingle();

            if (error) {
                console.error("Reply original loading error:", error);
                return;
            }

            original = data;
        }

        if (!original) {
            quoteName.textContent = "Original message";
            quoteText.textContent = "Message unavailable";
            return;
        }

        quoteName.textContent =
            original.sender_id === currentUser.id
                ? "You"
                : (original.sender_name || "Member");

        quoteText.textContent = original.message || "";

        replyQuote.addEventListener("click", function () {

            const target = chatArea.querySelector(
                '[data-message-id="' +
                CSS.escape(String(original.id)) +
                '"]'
            );

            if (!target) return;

            target.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

            target.classList.add("reply-message-highlight");

            setTimeout(function () {
                target.classList.remove("reply-message-highlight");
            }, 1800);

        });

    }

    loadReplyOriginal();

}


// MESSAGE TEXT

const text = document.createElement("span");

text.className = "message-text";

text.textContent = message.message;

    // MESSAGE FOOTER

    const footer = document.createElement("div");

    footer.className = "message-footer";

    // TIME

    const time = document.createElement("small");

    time.className = "message-time";

    time.textContent = formatMessageTime(message.created_at);

    footer.appendChild(time);

    // TICK ONLY FOR OWN MESSAGE

    if (isOwnMessage) {

        const tick = document.createElement("span");

        tick.className = "message-tick";

        tick.dataset.receiptFor = messageId;

        tick.textContent = "";

        footer.appendChild(tick);

    }

    // BUILD BUBBLE

    bubble.appendChild(sender);

    bubble.appendChild(text);

    bubble.appendChild(footer);

    // REACTION AREA

    const reactionArea = document.createElement("div");

    reactionArea.className = "message-reactions";

    const reactionAddButton = document.createElement("button");

    reactionAddButton.type = "button";

    reactionAddButton.className = "message-react-button";

    reactionAddButton.textContent = "☺";

    reactionAddButton.title = "Add reaction";

    // Keep keyboard open on mobile
reactionAddButton.addEventListener("pointerdown", function(event) {
    event.preventDefault();
});

    reactionAddButton.addEventListener("click", function (event) {

        event.stopPropagation();

        openReactionPicker(messageId, reactionAddButton);

    });

    reactionArea.appendChild(reactionAddButton);

    // APPEND ELEMENTS

    messageElement.appendChild(bubble);

    messageElement.appendChild(reactionArea);

    chatArea.appendChild(messageElement);

    renderMessageReactions(messageId);

    // RECEIPTS

    if (isOwnMessage) {

        updateSingleMessageReceiptStatus(messageId);

    } else {

        recordMessageDelivered(message);

        if (messageReadObserver) {
            messageReadObserver.observe(messageElement);
        }

    }

    scrollToBottom();

}


// ======================================
// READ RECEIPT: DELIVERED
// ======================================

async function recordMessageDelivered(message) {

    if (
        !currentUser ||
        !currentRoomId ||
        isRoomEnding ||
        message.sender_id === currentUser.id
    ) {
        return;
    }

    const messageId = String(message.id);
    const roomId = currentRoomId;

    if (deliveredReceiptPromises.has(messageId)) {
        return deliveredReceiptPromises.get(messageId);
    }

    const receiptPromise = (async function () {

        try {

            const { error } = await supabaseClient
                .from("message_receipts")
                .insert({
                    room_id: roomId,
                    message_id: Number(message.id),
                    user_id: currentUser.id,
                    status: "delivered",
                    delivered_at: new Date().toISOString()
                });

            if (error && error.code !== "23505") {
                throw error;
            }

        } catch (error) {

            console.error(
                "Message delivery receipt error:",
                error
            );

        }

    })();

    deliveredReceiptPromises.set(messageId, receiptPromise);

    return receiptPromise;

}


// ======================================
// READ RECEIPT: MARK AS READ
// ======================================

async function markMessageAsRead(messageId) {

    if (
        !currentUser ||
        !currentRoomId ||
        isRoomEnding ||
        document.visibilityState !== "visible"
    ) {
        return;
    }

    messageId = String(messageId);

    if (readReceiptPending.has(messageId)) return;

    const message = messageDataById.get(messageId);

    if (!message || message.sender_id === currentUser.id) return;

    readReceiptPending.add(messageId);

    const roomId = currentRoomId;

    try {

        await recordMessageDelivered(message);

        const { data: existing, error: selectError } =
            await supabaseClient
                .from("message_receipts")
                .select("id, read_at")
                .eq("room_id", roomId)
                .eq("message_id", Number(messageId))
                .eq("user_id", currentUser.id)
                .maybeSingle();

        if (selectError) throw selectError;

        if (!existing) {

            console.error("Delivery receipt not found:", messageId);

            return;

        }

        if (existing.read_at) return;

        const { error: updateError } = await supabaseClient
            .from("message_receipts")
            .update({
                status: "read",
                read_at: new Date().toISOString()
            })
            .eq("id", existing.id)
            .eq("user_id", currentUser.id)
            .is("read_at", null);

        if (updateError) throw updateError;

    } catch (error) {

        console.error("Read receipt error:", error);

    } finally {

        readReceiptPending.delete(messageId);

    }

}


// ======================================
// READ RECEIPT: VISIBILITY OBSERVER
// ======================================

function setupMessageReadObserver() {

    if (messageReadObserver) {
        messageReadObserver.disconnect();
    }

    if (!("IntersectionObserver" in window)) {
        console.warn("IntersectionObserver is not supported.");
        return;
    }

    messageReadObserver = new IntersectionObserver(
        function (entries) {

            if (document.visibilityState !== "visible") return;

            entries.forEach(entry => {

                if (
                    entry.isIntersecting &&
                    entry.intersectionRatio >= 0.5
                ) {

                    const messageId =
                        entry.target.dataset.messageId;

                    if (messageId) {
                        markMessageAsRead(messageId);
                    }

                }

            });

        },
        {
            root: chatArea,
            threshold: 0.5
        }
    );

}


// ======================================
// READ RECEIPT: TAB BECOMES VISIBLE
// ======================================

document.addEventListener("visibilitychange", function () {

    if (
        document.visibilityState !== "visible" ||
        !currentRoomId ||
        isRoomEnding ||
        !messageReadObserver
    ) {
        return;
    }

    const visibleMessages = chatArea.querySelectorAll(
        ".message.received[data-message-id]"
    );

    visibleMessages.forEach(element => {

        const rect = element.getBoundingClientRect();
        const chatRect = chatArea.getBoundingClientRect();

        const visibleHeight = Math.min(
            rect.bottom,
            chatRect.bottom
        ) - Math.max(
            rect.top,
            chatRect.top
        );

        if (
            visibleHeight > 0 &&
            visibleHeight >= rect.height * 0.5
        ) {

            markMessageAsRead(
                element.dataset.messageId
            );

        }

    });

});


// ======================================
// READ RECEIPT: UPDATE OWN MESSAGE TICK
// ======================================

async function updateSingleMessageReceiptStatus(messageId) {

    if (!currentRoomId || isRoomEnding) return;

    const roomId = currentRoomId;

    const { data, error } = await supabaseClient
        .from("message_receipts")
        .select("status, delivered_at, read_at")
        .eq("room_id", roomId)
        .eq("message_id", Number(messageId));

    if (error) {

        console.error("Receipt status loading error:", error);

        return;

    }

    if (currentRoomId !== roomId || isRoomEnding) return;

    const tick = chatArea.querySelector(
        '.message-tick[data-receipt-for="' +
        CSS.escape(String(messageId)) +
        '"]'
    );

    if (!tick) return;

    const receipts = data || [];

    const someoneRead = receipts.some(receipt =>
        receipt.read_at ||
        receipt.status === "read"
    );

    const someoneReceived = receipts.some(receipt =>
        receipt.delivered_at ||
        receipt.status === "delivered" ||
        receipt.read_at ||
        receipt.status === "read"
    );

    tick.classList.remove("delivered", "read");

    if (someoneRead) {

        tick.textContent = "✓✓";
        tick.classList.add("read");

    } else if (someoneReceived) {

        tick.textContent = "✓";
        tick.classList.add("delivered");

    } else {

        tick.textContent = "";

    }

}


// ======================================
// READ RECEIPT: LOAD ALL OWN MESSAGE TICKS
// ======================================

async function loadAllOwnMessageReceiptStatuses() {

    if (!currentRoomId || isRoomEnding) return;

    const roomId = currentRoomId;

    const ownMessageIds = [];

    messageDataById.forEach((message, messageId) => {

        if (message.sender_id === currentUser.id) {
            ownMessageIds.push(Number(messageId));
        }

    });

    if (ownMessageIds.length === 0) return;

    const { data, error } = await supabaseClient
        .from("message_receipts")
        .select("message_id, status, delivered_at, read_at")
        .eq("room_id", roomId)
        .in("message_id", ownMessageIds);

    if (error) {

        console.error("Receipt loading error:", error);

        return;

    }

    if (currentRoomId !== roomId || isRoomEnding) return;

    const grouped = new Map();

    (data || []).forEach(receipt => {

        const id = String(receipt.message_id);

        if (!grouped.has(id)) {
            grouped.set(id, []);
        }

        grouped.get(id).push(receipt);

    });

    ownMessageIds.forEach(id => {

        const messageId = String(id);

        const tick = chatArea.querySelector(
            '.message-tick[data-receipt-for="' +
            CSS.escape(messageId) +
            '"]'
        );

        if (!tick) return;

        const receipts = grouped.get(messageId) || [];

        const someoneRead = receipts.some(receipt =>
            receipt.read_at ||
            receipt.status === "read"
        );

        const someoneReceived = receipts.some(receipt =>
            receipt.delivered_at ||
            receipt.status === "delivered" ||
            receipt.read_at ||
            receipt.status === "read"
        );

        tick.classList.remove("delivered", "read");

        if (someoneRead) {

            tick.textContent = "✓✓";
            tick.classList.add("read");

        } else if (someoneReceived) {

            tick.textContent = "✓";
            tick.classList.add("delivered");

        } else {

            tick.textContent = "";

        }

    });

}


// ======================================
// REALTIME RECEIPTS
// ======================================

function subscribeToReceipts() {

    if (receiptChannel) {
        supabaseClient.removeChannel(receiptChannel);
    }

    const roomId = currentRoomId;

    receiptChannel = supabaseClient
        .channel("room-receipts-" + roomId)

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "message_receipts",
                filter: "room_id=eq." + roomId
            },
            function (payload) {

                if (
                    currentRoomId !== roomId ||
                    isRoomEnding
                ) {
                    return;
                }

                const receipt =
                    payload.new && Object.keys(payload.new).length
                        ? payload.new
                        : payload.old;

                if (!receipt || !receipt.message_id) return;

                const messageId = String(receipt.message_id);

                const message = messageDataById.get(messageId);

                if (
                    message &&
                    message.sender_id === currentUser.id
                ) {

                    updateSingleMessageReceiptStatus(messageId);

                }

            }
        )

        .subscribe(function (status) {

            console.log("Receipt channel status:", status);

        });

}


// ======================================
// REACTION EMOJIS
// ======================================

const reactionEmojis = [
    "❤️",
    "😂",
    "😮",
    "😢",
    "😡",
    "👍",
    "🔥"
];


// ======================================
// CREATE REACTION PICKER
// ======================================

let activeReactionPicker = null;

function openReactionPicker(messageId, button) {

    closeReactionPicker();

    const picker = document.createElement("div");

    picker.className = "reaction-picker";

    reactionEmojis.forEach(emoji => {

        const emojiButton = document.createElement("button");

        emojiButton.type = "button";
        emojiButton.textContent = emoji;

        // Prevent keyboard from hiding
emojiButton.addEventListener("pointerdown", function(event) {
    event.preventDefault();
});

        emojiButton.addEventListener("click", async function (event) {

            event.stopPropagation();

            closeReactionPicker();

            await toggleReaction(messageId, emoji);

        });

        picker.appendChild(emojiButton);

    });

    document.body.appendChild(picker);

    const rect = button.getBoundingClientRect();

    picker.style.position = "fixed";

    let left = rect.left;

    if (left + 250 > window.innerWidth) {
        left = window.innerWidth - 260;
    }

    let top = rect.top - 55;

    if (top < 10) {
        top = rect.bottom + 8;
    }

    picker.style.left = Math.max(10, left) + "px";
    picker.style.top = top + "px";

    activeReactionPicker = picker;

    setTimeout(() => {

        document.addEventListener(
            "click",
            closeReactionPickerOutside,
            { once: true }
        );

    }, 0);

}


function closeReactionPickerOutside(event) {

    if (
        activeReactionPicker &&
        !activeReactionPicker.contains(event.target)
    ) {
        closeReactionPicker();
    }

}


function closeReactionPicker() {

    if (activeReactionPicker) {

        activeReactionPicker.remove();

        activeReactionPicker = null;

    }

}


// ======================================
// TOGGLE / CHANGE REACTION
// ======================================

async function toggleReaction(messageId, emoji) {

    if (!currentRoomId || !currentUser || isRoomEnding) return;

    const roomId = currentRoomId;

    try {

        const { data: existing, error: selectError } =
            await supabaseClient
                .from("message_reactions")
                .select("id, emoji")
                .eq("room_id", roomId)
                .eq("message_id", String(messageId))
                .eq("user_id", currentUser.id)
                .maybeSingle();

        if (selectError) throw selectError;

        if (existing) {

            const { error: deleteError } = await supabaseClient
                .from("message_reactions")
                .delete()
                .eq("id", existing.id);

            if (deleteError) throw deleteError;

            if (existing.emoji === emoji) {
                await loadMessageReactions(messageId);
                return;
            }

        }

        const { error: insertError } = await supabaseClient
            .from("message_reactions")
            .insert({

                room_id: roomId,
                message_id: String(messageId),
                user_id: currentUser.id,
                emoji: emoji

            });

        if (insertError) throw insertError;

        await loadMessageReactions(messageId);

    } catch (error) {

        console.error("Reaction error:", error);

        alert("Reaction add nahi ho paya: " + error.message);

    }

}


// ======================================
// LOAD ALL REACTIONS
// ======================================

async function loadAllReactions() {

    if (!currentRoomId || isRoomEnding) return;

    const roomId = currentRoomId;

    const { data, error } = await supabaseClient
        .from("message_reactions")
        .select("*")
        .eq("room_id", roomId);

    if (error) {

        console.error("Reaction loading error:", error);

        return;

    }

    if (currentRoomId !== roomId || isRoomEnding) return;

    reactionsByMessage.clear();

    (data || []).forEach(reaction => {

        const messageId = String(reaction.message_id);

        if (!reactionsByMessage.has(messageId)) {
            reactionsByMessage.set(messageId, []);
        }

        reactionsByMessage.get(messageId).push(reaction);

    });

    displayedMessageIds.forEach(messageId => {
        renderMessageReactions(messageId);
    });

}


// ======================================
// LOAD REACTIONS FOR ONE MESSAGE
// ======================================

async function loadMessageReactions(messageId) {

    if (!currentRoomId || isRoomEnding) return;

    const roomId = currentRoomId;

    const { data, error } = await supabaseClient
        .from("message_reactions")
        .select("*")
        .eq("room_id", roomId)
        .eq("message_id", String(messageId));

    if (error) {

        console.error("Reaction update error:", error);

        return;

    }

    if (currentRoomId !== roomId || isRoomEnding) return;

    reactionsByMessage.set(
        String(messageId),
        data || []
    );

    renderMessageReactions(messageId);

}


// ======================================
// RENDER MESSAGE REACTIONS
// ======================================

function renderMessageReactions(messageId) {

    const messageElement = chatArea.querySelector(
        '.message[data-message-id="' + CSS.escape(String(messageId)) + '"]'
    );

    if (!messageElement) return;

    const reactionArea =
        messageElement.querySelector(".message-reactions");

    if (!reactionArea) return;

    reactionArea.querySelectorAll(".reaction-chip").forEach(item => {
        item.remove();
    });

    const reactions =
        reactionsByMessage.get(String(messageId)) || [];

    const grouped = new Map();

    reactions.forEach(reaction => {

        if (!grouped.has(reaction.emoji)) {
            grouped.set(reaction.emoji, []);
        }

        grouped.get(reaction.emoji).push(reaction);

    });

    grouped.forEach((users, emoji) => {

        const chip = document.createElement("button");

        chip.type = "button";
        chip.className = "reaction-chip";


        // Keep input focus while selecting reactions
chip.addEventListener("pointerdown", function(event) {
    event.preventDefault();
});

        const ownReaction = users.some(
            item => item.user_id === currentUser.id
        );

        if (ownReaction) {
            chip.classList.add("my-reaction");
        }

        chip.textContent = emoji + " " + users.length;

        chip.title = ownReaction
            ? "Click to remove your reaction"
            : "Click to react with " + emoji;

        chip.addEventListener("click", function () {

            toggleReaction(messageId, emoji);

        });

        reactionArea.appendChild(chip);

    });

}


// ======================================
// REALTIME REACTIONS
// ======================================

function subscribeToReactions() {

    if (reactionChannel) {
        supabaseClient.removeChannel(reactionChannel);
    }

    const roomId = currentRoomId;

    reactionChannel = supabaseClient
        .channel("room-reactions-" + roomId)

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "message_reactions"
            },
            function () {

                if (
                    currentRoomId === roomId &&
                    !isRoomEnding
                ) {

                    loadAllReactions();

                }

            }
        )

        .subscribe(function (status) {

            console.log("Reaction channel status:", status);

        });

}


// ======================================
// SEND MESSAGE
// ======================================
// ======================================
// SEND MESSAGE WITH TELEGRAM REPLY
// ======================================


messageForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    if (messageForm.dataset.sending === "true") return;

    const message = messageInput.value.trim();

    if (!message || !currentRoomId || !currentUser || isRoomEnding) {
        return;
    }

    if (
        currentRoomExpiry &&
        currentRoomExpiry.getTime() <= Date.now()
    ) {
        expireCurrentRoom();
        return;
    }

    const roomId = currentRoomId;

    const replyToId = currentReplyMessage
        ? currentReplyMessage.id
        : null;

    stopTypingBroadcast();

    const sendBtn = document.getElementById("sendBtn");

    messageForm.dataset.sending = "true";
    sendBtn.disabled = true;

    try {

        const { data, error } = await supabaseClient
            .from("room_messages")
            .insert({
                room_id: roomId,
                sender_id: currentUser.id,
                message: message,
                reply_to_id: replyToId
            })
            .select()
            .single();

        if (error) throw error;

        if (currentRoomId !== roomId || isRoomEnding) return;

        addMessage(data);
        playMessageSound("send");

        messageInput.value = "";

        if (
            currentReplyMessage &&
            String(currentReplyMessage.id) === String(replyToId)
        ) {
            cancelReplyMessage();
        }

    } catch (error) {

        console.error("Message sending error:", error);

        alert("Message send nahi hua: " + error.message);

    } finally {

        messageForm.dataset.sending = "false";

      

            if (!isRoomEnding && currentRoomId === roomId) {
    sendBtn.disabled = false;

   
}

    }

});

// Keep mobile keyboard open while sending messages
const sendButton = document.getElementById("sendBtn");

sendButton?.addEventListener("pointerdown", function (event) {
    event.preventDefault();
});

// ======================================
// ONLINE PRESENCE + TYPING INDICATOR
// ======================================

function setupPresenceUI() {

    if (presenceStatusElement) presenceStatusElement.remove();
    if (typingIndicatorElement) typingIndicatorElement.remove();

    presenceStatusElement = document.createElement("p");
    presenceStatusElement.id = "presenceStatus";
    presenceStatusElement.className = "presence-status";
    presenceStatusElement.textContent = "🟢 Online: 1 · ⚪ Offline: 0";

    const roomInfo = roomSection.querySelector(".room-info");

    if (roomInfo) {
        roomInfo.insertAdjacentElement("afterend", presenceStatusElement);
    }

    typingIndicatorElement = document.createElement("div");
    typingIndicatorElement.id = "typingIndicator";
    typingIndicatorElement.className = "typing-indicator";
    typingIndicatorElement.textContent = "";
    typingIndicatorElement.hidden = true;

    messageForm.insertAdjacentElement("beforebegin", typingIndicatorElement);

}


function refreshPresenceStatus() {

    if (!presenceStatusElement) return;

    const totalMembers = Number(
        (memberCount.textContent.match(/\d+/g) || [1])[0]
    ) || 1;

    const online = Math.min(onlineUserIds.size, totalMembers);
    const offline = Math.max(0, totalMembers - online);

    presenceStatusElement.textContent =
        "🟢 Online: " + online + " · ⚪ Offline: " + offline;

}


function subscribeToPresence() {

    if (!currentRoomId || !currentUser) return;

    if (presenceChannel) {
        supabaseClient.removeChannel(presenceChannel);
    }

    const roomId = currentRoomId;

    presenceChannel = supabaseClient.channel(
        "room-presence-" + roomId,
        { config: { presence: { key: currentUser.id } } }
    );

    presenceChannel

        .on("presence", { event: "sync" }, function () {

            if (currentRoomId !== roomId || isRoomEnding) return;

            const state = presenceChannel.presenceState();
            const ids = new Set();

            Object.values(state).forEach(entries => {

                entries.forEach(entry => {

                    if (entry.user_id) {
                        ids.add(entry.user_id);
                    }

                });

            });

            onlineUserIds = ids;

            refreshPresenceStatus();

        })

        .on("broadcast", { event: "typing" }, function (event) {

            if (currentRoomId !== roomId || isRoomEnding) return;

            if (
                !event.payload ||
                event.payload.user_id === currentUser.id
            ) {
                return;
            }

            if (event.payload.is_typing) {
                showTypingIndicator();
            } else {
                hideTypingIndicator();
            }

        })

        .subscribe(async function (status) {

            if (
                status === "SUBSCRIBED" &&
                currentRoomId === roomId &&
                !isRoomEnding
            ) {

                const { error } = await presenceChannel.track({
                    user_id: currentUser.id,
                    online_at: new Date().toISOString()
                });

                if (error) {
                    console.error("Presence tracking error:", error);
                }

            }

            console.log("Presence channel status:", status);

        });

}


function showTypingIndicator() {

    if (!typingIndicatorElement) return;

    typingIndicatorElement.textContent = "Someone is typing...";
    typingIndicatorElement.hidden = false;

    clearTimeout(typingStopTimer);

    typingStopTimer = setTimeout(
        hideTypingIndicator,
        2200
    );

}


function hideTypingIndicator() {

    if (!typingIndicatorElement) return;

    typingIndicatorElement.hidden = true;
    typingIndicatorElement.textContent = "";

}


function sendTypingBroadcast(isTyping) {

    if (
        !presenceChannel ||
        !currentUser ||
        !currentRoomId ||
        isRoomEnding
    ) {
        return;
    }

    presenceChannel.send({
        type: "broadcast",
        event: "typing",
        payload: {
            user_id: currentUser.id,
            is_typing: isTyping
        }
    }).catch(error => {
        console.error("Typing broadcast error:", error);
    });

}


function stopTypingBroadcast() {

    clearTimeout(typingStopTimer);

    sendTypingBroadcast(false);

}


messageInput.addEventListener("input", function () {

    if (!currentRoomId || isRoomEnding) return;

    if (messageInput.value.trim()) {

        sendTypingBroadcast(true);

        clearTimeout(typingStopTimer);

        typingStopTimer = setTimeout(
            stopTypingBroadcast,
            1400
        );

    } else {

        stopTypingBroadcast();

    }

});


messageInput.addEventListener("blur", stopTypingBroadcast);





/* =========================================
   LUDO LIVE CHAT MESSAGE POPUP
========================================= */

let ludoChatNotificationQueue = [];
let ludoChatNotificationVisible = false;

function showLudoChatNotification(message) {

    const ludoSection = document.getElementById("ludoSection");

    // Ludo open nahi hai to popup mat dikhao
    if (!ludoSection || ludoSection.hidden) return;

    const notification = document.getElementById("ludoChatNotification");

    const senderElement = document.getElementById("ludoChatNotificationSender");

    const textElement = document.getElementById("ludoChatNotificationText");

    if (!notification || !senderElement || !textElement) return;

    ludoChatNotificationQueue.push({
        sender: message.sender_name || "Member",
        text: message.message || ""
    });

    if (!ludoChatNotificationVisible) {
        showNextLudoChatNotification();
    }
}

function showNextLudoChatNotification() {

    const notification = document.getElementById("ludoChatNotification");

    const senderElement = document.getElementById("ludoChatNotificationSender");

    const textElement = document.getElementById("ludoChatNotificationText");

    if (!notification || !senderElement || !textElement) return;

    if (ludoChatNotificationQueue.length === 0) {
        ludoChatNotificationVisible = false;
        notification.hidden = true;
        return;
    }

    ludoChatNotificationVisible = true;

    const nextMessage = ludoChatNotificationQueue.shift();

    senderElement.textContent = nextMessage.sender;

    textElement.textContent = nextMessage.text;

    notification.hidden = false;

    setTimeout(function () {

        notification.hidden = true;

        showNextLudoChatNotification();

    }, 3500);
}

// ======================================
// REALTIME MESSAGES
// ======================================

function subscribeToMessages() {

    if (messageChannel) {
        supabaseClient.removeChannel(messageChannel);
    }

    const roomId = currentRoomId;

    messageChannel = supabaseClient
        .channel("room-messages-" + roomId)

        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "room_messages",
                filter: "room_id=eq." + roomId
            },
            function (payload) {

                if (
                    !isRoomEnding &&
                    currentRoomId === roomId
                ) {

                    const incomingMessage = payload.new;

                    // Sirf naye doosre users ke messages
                    if (
                        incomingMessage.sender_id !== currentUser.id &&
                        !displayedMessageIds.has(String(incomingMessage.id))
                    ) {

                        // Existing sound system
                        playMessageSound("receive");

                        // Ludo board par popup
                        showLudoChatNotification(incomingMessage);
                    }

                    addMessage(incomingMessage);
                }

            }
        )

        .subscribe(function (status) {

            console.log("Message channel status:", status);

        });

}


// ======================================
// UPDATE MEMBER COUNT
// ======================================

async function updateMemberCount() {

    if (!currentRoomId || isRoomEnding) return;

    const roomId = currentRoomId;

    const { data, error } = await supabaseClient
        .from("room_members")
        .select("user_id")
        .eq("room_id", roomId);

    if (error) {

        console.error("Member count error:", error);

        return;

    }

    if (currentRoomId !== roomId || isRoomEnding) return;

    memberCount.textContent =
        "Members: " + data.length + "/10";

    refreshPresenceStatus();

}


// ======================================
// REALTIME MEMBER COUNT
// ======================================

function subscribeToMembers() {

    if (memberChannel) {
        supabaseClient.removeChannel(memberChannel);
    }

    const roomId = currentRoomId;

    memberChannel = supabaseClient
        .channel("room-members-" + roomId)

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "room_members",
                filter: "room_id=eq." + roomId
            },
            function () {

                if (
                    currentRoomId === roomId &&
                    !isRoomEnding
                ) {

                    updateMemberCount();

                }

            }
        )

        .subscribe(function (status) {

            console.log("Member channel status:", status);

        });

}


// ======================================
// COPY ROOM ID
// ======================================

copyRoomCodeBtn.addEventListener("click", async function () {

    if (!currentRoomCode) return;

    try {

        await navigator.clipboard.writeText(currentRoomCode);

        copyRoomCodeBtn.textContent = "Copied!";

        setTimeout(function () {

            copyRoomCodeBtn.textContent = "Copy ID";

        }, 2000);

    } catch (error) {

        alert("Your Room ID: " + currentRoomCode);

    }

});


// ======================================
// LEAVE ROOM
// ======================================

async function leaveCurrentRoom() {

    if (!currentRoomId) return;

    const roomId = currentRoomId;

    leaveRoomBtn.disabled = true;

    try {

        const { data, error } = await supabaseClient
            .rpc("leave_chat_room", {
                p_room_id: roomId
            });

        if (error) throw error;

        console.log("Room membership removed:", data);

    } catch (error) {

        console.error("Leave room error:", error);

        alert("Room leave nahi hua: " + error.message);

        leaveRoomBtn.disabled = false;

        return;

    }

    clearRoomSession();
    if (mobilePlayLudoBtn) {
    mobilePlayLudoBtn.hidden = true;
}

    clearInterval(expiryTimer);
    clearInterval(memberRefreshTimer);
    clearInterval(serverExpiryCheckTimer);

    await removeRoomChannels();

    closeEmojiPicker();
    closeReactionPicker();

    if (window.destroyLudo) {
        await window.destroyLudo();
    }

    currentRoomId = null;
    currentRoomCode = null;
    currentRoomExpiry = null;

    isRoomEnding = false;

    displayedMessageIds.clear();
    reactionsByMessage.clear();

    messageDataById.clear();
    deliveredReceiptPromises.clear();
    readReceiptPending.clear();

    chatArea.innerHTML = "";

    roomTimer.textContent = "Time Left: 59:59";
    roomTimer.classList.remove("urgent");

    memberCount.textContent = "Members: 1/10";

    messageInput.value = "";
    messageInput.disabled = false;

    if (emojiPickerButton) {
        emojiPickerButton.disabled = false;
    }

    const sendBtn = document.getElementById("sendBtn");

    if (sendBtn) sendBtn.disabled = false;

    roomSection.hidden = true;
    roomSetup.hidden = false;

    inviteCodeInput.value = "";

    roomStatus.textContent = "";

    leaveRoomBtn.disabled = false;

}


// ======================================
// LEAVE ROOM BUTTON
// ======================================

leaveRoomBtn.addEventListener("click", async function () {

    if (!confirm("Are you sure you want to leave this room?")) {
        return;
    }

    await leaveCurrentRoom();

});


// ======================================
// SCROLL
// ======================================

function scrollToBottom() {

    chatArea.scrollTop = chatArea.scrollHeight;

}


// ======================================
// INITIALIZE
// ======================================

injectReceiptStyles();

createEmojiPicker();

initializeAuth();




// ======================================
// MOBILE SIDEBAR SETTINGS
// ======================================

// ======================================
// MOBILE SIDEBAR SETTINGS
// ======================================

function initializeMobileSidebar() {

    const mobileMenu = document.querySelector(".mobile-menu");

    if (!mobileMenu) return;


    // MESSAGE SOUND TOGGLE

    const soundToggle = document.getElementById("messageSoundToggle");

    if (soundToggle) {

        soundToggle.checked = messageSoundsEnabled;

        soundToggle.addEventListener("change", function () {

            messageSoundsEnabled = soundToggle.checked;

            localStorage.setItem(
                "messageSoundsEnabled",
                String(messageSoundsEnabled)
            );

        });

    }


    // HAMBURGER CLICK

    const menuToggle = mobileMenu.querySelector(".mobile-menu-toggle");

    if (menuToggle) {

        menuToggle.addEventListener("click", function () {

            mobileMenu.classList.toggle("is-open");

            const isOpen = mobileMenu.classList.contains("is-open");

            menuToggle.setAttribute("aria-expanded", String(isOpen));

            menuToggle.setAttribute(
                "aria-label",
                isOpen ? "Close navigation menu" : "Open navigation menu"
            );

        });

    }


    // OUTSIDE CLICK CLOSE

    document.addEventListener("click", function (event) {

        if (
            mobileMenu.classList.contains("is-open") &&
            !mobileMenu.contains(event.target)
        ) {

            mobileMenu.classList.remove("is-open");

            if (menuToggle) {
                menuToggle.setAttribute("aria-expanded", "false");
                menuToggle.setAttribute("aria-label", "Open navigation menu");
            }

        }

    });


    // SIDEBAR LINK CLICK CLOSE

    const menuLinks = mobileMenu.querySelectorAll(
        ".mobile-menu-content a"
    );

    menuLinks.forEach(function (link) {

        link.addEventListener("click", function () {

            mobileMenu.classList.remove("is-open");

            if (menuToggle) {
                menuToggle.setAttribute("aria-expanded", "false");
                menuToggle.setAttribute("aria-label", "Open navigation menu");
            }

        });

    });

}


if (document.readyState === "loading") {

    document.addEventListener("DOMContentLoaded", initializeMobileSidebar);

} else {

    initializeMobileSidebar();

}