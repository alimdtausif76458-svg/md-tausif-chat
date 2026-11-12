
// ==========================================
// MD TAUSIF CHAT - ROYAL LUDO ARENA
// COMPLETE SYNCHRONIZED JAVASCRIPT
// SCORE + TIMER + FINISH + CAPTURE
// UPDATED TOKEN NUMBERING
// ==========================================
let ludoColorRefreshTimer = null;
let ludoGameId = null;
let ludoCurrentRoomId = null;

let ludoGameChannel = null;
let ludoPlayersChannel = null;
let ludoMovesChannel = null;

let ludoLoaded = false;
let ludoLoading = false;
let ludoBusy = false;

let ludoAnimatingTokens = false;
let ludoDiceRolling = false;

let ludoPendingDiceValue = null;
let ludoAutoPassKey = null;
let ludoAutoPassTimer = null;

let ludoLoadVersion = 0;
let ludoRoomVersion = 0;
let ludoMoveAnimationId = 0;

let ludoAudioContext = null;

let ludoTurnTimerInterval = null;
let ludoTurnTimerDeadline = null;

let ludoTimeoutInFlight = false;
let ludoTimeoutKey = null;

let ludoSeenMoveIds = new Set();

window.ludoPlayers = [];
window.ludoGameData = null;


// ==========================================
// COLORS
// ==========================================

const LUDO_COLORS = [
    "red",
    "green",
    "yellow",
    "blue"
];


// =====================================================
// LUDO PLAYER DISPLAY NAME
// =====================================================

function getLudoPlayerDisplayName(color) {

    const profiles =
        typeof LUDO_PLAYER_PROFILES !== "undefined"
            ? LUDO_PLAYER_PROFILES
            : {};

    const profile = profiles[color] || {};

    const name = (profile.name || "").trim();

    const colorName = String(color || "PLAYER").toUpperCase();

    return name
        ? `${name} (${colorName})`
        : colorName;
}

// =====================================================
// LUDO PLAYER IDENTITY - FUTURE NAME SUPPORT
// =====================================================

const LUDO_PLAYER_PROFILES = {
    red: {
        name: "",
        avatar: ""
    },
    green: {
        name: "",
        avatar: ""
    },
    yellow: {
        name: "",
        avatar: ""
    },
    blue: {
        name: "",
        avatar: ""
    }
};

// Player ka display name
// =====================================================
// LUDO FINAL LEADERBOARD DATA
// =====================================================

function getLudoFinalLeaderboard(game) {
    if (!game || game.status !== "finished") {
        return [];
    }

    const players = window.ludoPlayers || [];
    const leftInfo = window.ludoLeftInfo || {};

    let winnerColor = null;

    // Normal game winner
    if (game.game_state) {
        LUDO_COLORS.forEach(color => {
            const tokens = game.game_state[color];

            if (
                Array.isArray(tokens) &&
                tokens.length === 4 &&
                tokens.every(position => Number(position) === 57)
            ) {
                winnerColor = color;
            }
        });
    }

    // Winner when all opponents leave
    if (!winnerColor && game.current_turn_user_id) {
        const winner = players.find(
            player =>
                player.user_id === game.current_turn_user_id
        );

        if (winner) {
            winnerColor = winner.player_color;
        }
    }

    const leaderboard = [];

    // Active players
    players.forEach(player => {
        leaderboard.push({
            color: player.player_color,
            user_id: player.user_id,
            score: Number(player.score || 0),
            left: false,
            winner: player.player_color === winnerColor
        });
    });

    // Players who left
    Object.values(leftInfo).forEach(player => {
        if (!leaderboard.some(item => item.color === player.color)) {
            leaderboard.push({
                color: player.color,
                user_id: player.user_id || null,
                score: Number(player.score || 0),
                left: true,
                winner: false
            });
        }
    });

    // Winner first, then remaining players by score
    leaderboard.sort((a, b) => {
        if (a.winner) return -1;
        if (b.winner) return 1;

        return b.score - a.score;
    });

    // Assign ranking
    leaderboard.forEach((player, index) => {
        player.rank = index + 1;
        player.name = getLudoPlayerDisplayName(player.color);
    });

    return leaderboard;
}


// =====================================================
// LUDO FINAL RESULTS POPUP
// =====================================================

// =====================================================
// LUDO FINAL RESULTS POPUP
// =====================================================

function showLudoFinalResults(game) {

    if (!game || game.status !== "finished") return;

    const leaderboard = getLudoFinalLeaderboard(game);

    if (!leaderboard.length) return;

    // Prevent popup from reopening on every realtime update
    window.ludoResultShownGameIds =
        window.ludoResultShownGameIds || new Set();

    if (window.ludoResultShownGameIds.has(game.id)) {
        return;
    }

    window.ludoResultShownGameIds.add(game.id);

    // Find winner
    const winner = leaderboard.find(player => player.winner);

    // Find current user's result
    const currentUserId = currentUser?.id || null;

    const myResult = leaderboard.find(
        player => player.user_id === currentUserId
    );

    // Prepare player rows
    const resultsHTML = leaderboard.map(player => {

        let status = "LOST";

        if (player.winner) {
            status = "🏆 WINNER";
        } else if (player.left) {
            status = "LEFT";
        }

        return `
            <div class="ludo-result-row ${player.winner ? "winner-row" : ""} ${player.left ? "left-row" : ""}">

                <div class="ludo-result-rank">
                    #${player.rank}
                </div>

                <div class="ludo-result-color ${player.color}">
                    <span></span>
                    ${player.name}
                </div>

                <div class="ludo-result-score">
                    ${player.score} PTS
                </div>

                <div class="ludo-result-status">
                    ${status}
                </div>

            </div>
        `;

    }).join("");

    // Decide personal result message
    let resultHeading = "GAME OVER!";
    let resultSubheading = "FINAL RESULTS";
    let resultIcon = "🏆";
    let resultClass = "ludo-result-neutral";

    if (myResult?.winner) {

        resultHeading = "CONGRATULATIONS!";
        resultSubheading = "🏆 YOU ARE THE WINNER!";
        resultClass = "ludo-result-victory";

    } else if (myResult?.left) {

        resultHeading = "GAME OVER!";
        resultSubheading = "YOU LEFT THIS GAME";
        resultIcon = "🚪";
        resultClass = "ludo-result-left";

    } else if (myResult) {

        resultHeading = "GAME OVER!";
        resultSubheading = "🔴 YOU LOST!";
        resultIcon = "💔";
        resultClass = "ludo-result-defeat";
    }

    // Create popup
    const overlay = document.createElement("div");

    overlay.className = "ludo-final-results-overlay";

    overlay.innerHTML = `
        <div class="ludo-final-results-card ${resultClass}">

            <div class="ludo-result-trophy">
                ${resultIcon}
            </div>

            <h1>${resultHeading}</h1>

            <h2>${resultSubheading}</h2>

            <div class="ludo-result-subtitle">
                MATCH COMPLETED
            </div>

            <div class="ludo-result-table">

                <div class="ludo-result-header">
                    <span>RANK</span>
                    <span>PLAYER</span>
                    <span>SCORE</span>
                    <span>STATUS</span>
                </div>

                ${resultsHTML}

            </div>

            <button class="ludo-result-close-btn">
                CLOSE
            </button>

        </div>
    `;

    document.body.appendChild(overlay);

    // Close popup
    overlay.querySelector(".ludo-result-close-btn")
        .addEventListener("click", () => {
            overlay.remove();
        });
}
// ==========================================
// SAFE TEXT
// ==========================================

function escapeLudoText(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ==========================================
// EXTRA STYLE
// ==========================================

function injectLudoExtraStyles() {

    if (document.getElementById("ludoExtraStyles")) return;

    const style = document.createElement("style");

    style.id = "ludoExtraStyles";

    style.textContent = `

        .ludo-turn-timer {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            margin: 8px auto;
            padding: 7px 15px;
            border: 1px solid rgba(245,201,106,.55);
            border-radius: 30px;
            background: rgba(0,0,0,.24);
            color: #ffe3a0;
            font-weight: 800;
            font-size: 14px;
            letter-spacing: .5px;
            min-width: 145px;
        }

        .ludo-turn-timer[hidden] {
            display: none !important;
        }

        .ludo-turn-timer.urgent {
            color: #ff4444;
            border-color: #ff4444;
            animation: ludoTimerPulse .7s infinite alternate;
        }

        @keyframes ludoTimerPulse {
            from { opacity: 1; }
            to { opacity: .55; }
        }

        .ludo-player-score {
            display: block;
            margin-top: 5px;
            color: #ffd878;
            font-weight: 800;
            font-size: 12px;
        }

        .ludo-finished-tokens {
            position: absolute;
            inset: 10%;
            z-index: 30;
            display: flex;
            flex-wrap: wrap;
            align-content: center;
            justify-content: center;
            align-items: center;
            gap: 3px;
            pointer-events: none;
        }

        .ludo-finished-group {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            align-items: center;
            gap: 2px;
            max-width: 45%;
            min-width: 25%;
        }

        .ludo-finished-group .ludo-token {
            width: 15px !important;
            height: 15px !important;
            min-width: 15px !important;
            min-height: 15px !important;
            position: relative !important;
            left: auto !important;
            top: auto !important;
            transform: none !important;
            margin: 0 !important;
            pointer-events: none !important;
        }

        .ludo-finished-group .ludo-token.is-finished-token {
            opacity: 1;
            filter: drop-shadow(0 0 4px gold);
        }

        .ludo-winner-badge {
            position: absolute;
            z-index: 50;
            left: 50%;
            top: 5px;
            transform: translateX(-50%);
            padding: 5px 9px;
            border-radius: 20px;
            border: 2px solid #fff0a6;
            background: linear-gradient(135deg,#9d6500,#ffd85a,#a56b00);
            color: #271700;
            font-size: 11px;
            font-weight: 1000;
            white-space: nowrap;
            box-shadow: 0 0 15px rgba(255,210,70,.9);
            pointer-events: none;
        }

        .ludo-finish-effect {
            z-index: 100;
        }

        #ludoGame .ludo-center {
            position: relative;
        }







        /* COLOUR SELECTION POPUP */

.ludo-color-overlay {
    position: fixed;
    inset: 0;
    z-index: 999999;
    background: rgba(0,0,0,.85);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 15px;
}

.ludo-color-modal {
    width: 100%;
    max-width: 360px;
    padding: 25px 20px;
    border-radius: 18px;
    background: linear-gradient(145deg,#20202d,#101018);
    border: 2px solid #d6a849;
    box-shadow: 0 0 30px rgba(255,190,50,.3);
    text-align: center;
}

.ludo-color-modal h2 {
    color: #ffd875;
    margin: 0 0 8px;
}

.ludo-color-modal p {
    color: #ddd;
    margin-bottom: 20px;
}

.ludo-color-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.ludo-color-option {
    padding: 16px 8px;
    border: 2px solid rgba(255,255,255,.3);
    border-radius: 12px;
    color: white;
    font-size: 16px;
    font-weight: 900;
    cursor: pointer;
    transition: .2s;
}

.ludo-color-option.red {
    background: #c62828;
}

.ludo-color-option.green {
    background: #168b40;
}

.ludo-color-option.yellow {
    background: #d6a900;
    color: #171000;
}

.ludo-color-option.blue {
    background: #1565c0;
}

.ludo-color-option:disabled {
    opacity: .25;
    cursor: not-allowed;
    filter: grayscale(1);
}

.ludo-color-option:not(:disabled):hover {
    transform: scale(1.05);
    border-color: white;
}

.ludo-color-option:disabled::after {
    content: " TAKEN";
    font-size: 10px;
}

.ludo-color-close {
    margin-top: 18px;
    padding: 10px 25px;
    border: 1px solid #aaa;
    border-radius: 20px;
    background: transparent;
    color: white;
    cursor: pointer;
}

    `;

    document.head.appendChild(style);
}


// ==========================================
// INITIALIZE LUDO
// ==========================================

window.initLudo = async function(roomId) {

    if (!roomId || typeof supabaseClient === "undefined") {
        console.error("Ludo: Room ID or Supabase client missing.");
        return;
    }

    injectLudoExtraStyles();

    if (ludoCurrentRoomId !== roomId) {

        ludoRoomVersion++;
        ludoLoadVersion++;

        removeLudoRealtime();
        clearLudoAutoPass();
        stopLudoTurnTimer();

        ludoCurrentRoomId = roomId;
        ludoGameId = null;

        window.ludoGameData = null;
        window.ludoPlayers = [];

        ludoBusy = false;
        ludoAnimatingTokens = false;
        ludoDiceRolling = false;

        ludoTimeoutInFlight = false;
        ludoTimeoutKey = null;
        ludoSeenMoveIds.clear();

        updateLudoDiceHand();
    }

    const mount = document.getElementById("ludoMount");

    if (!mount || ludoLoading) return;

    ludoLoading = true;

    try {

        if (!ludoLoaded) {

            mount.innerHTML = `
                <div class="ludo-loading">
                    Loading Ludo Arena...
                </div>
            `;

            const response = await fetch(
                new URL("ludo.html", document.baseURI)
            );

            if (!response.ok) {
                throw new Error(
                    "Unable to load ludo.html. HTTP " + response.status
                );
            }

            const html = await response.text();

            if (!html.trim()) {
                throw new Error("ludo.html is empty.");
            }

            if (!document.getElementById("ludoMount")) return;

            mount.innerHTML = html;

            ludoLoaded = true;

            attachLudoEvents();
            buildLudoBoard();
            ensureLudoTimerElement();
            ensureLudoFinishedContainer();

            updateLudoDiceHand();
        }

        await loadLudoGame();

    } catch (error) {

        console.error("Ludo initialization error:", error);

        mount.innerHTML = `
            <div class="ludo-load-error">
                <h3>⚠️ Ludo Load Error</h3>
                <p>${escapeLudoText(error.message)}</p>
                <button type="button" onclick="window.retryLudo()">
                    Retry Loading
                </button>
            </div>
        `;

    } finally {

        ludoLoading = false;
        updateLudoDiceHand();

    }
};


// ==========================================
// RETRY
// ==========================================

window.retryLudo = async function() {

    ludoLoaded = false;

    const mount = document.getElementById("ludoMount");

    if (mount) mount.innerHTML = "";

    await window.initLudo(ludoCurrentRoomId);
};


// ==========================================
// OPEN / CLOSE LUDO
// ==========================================

async function openLudoPage() {

    if (!currentRoomId) {
        alert("Please join a chat room first.");
        return;
    }

    const section = document.getElementById("ludoSection");
    const button = document.getElementById("openLudoBtn");

    if (!section) return;

    if (!section.hidden) {

        section.hidden = true;

        if (button) {
            button.textContent = "🎲 Play Ludo";
            button.setAttribute("aria-expanded", "false");
        }

        updateLudoDiceHand();
        return;
    }

    section.hidden = false;

    if (button) {
        button.textContent = "✖ Close Ludo";
        button.setAttribute("aria-expanded", "true");
    }

    await window.initLudo(currentRoomId);

    section.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


// ==========================================
// EVENTS
// ==========================================

function attachLudoEvents() {

    const joinBtn = document.getElementById("joinLudoBtn");
    const leaveBtn = document.getElementById("leaveLudoBtn");
    const startBtn = document.getElementById("startLudoBtn");
    const diceBtn = document.getElementById("ludoDice");

    const leaveModal = document.getElementById("leaveLudoModal");
    const cancelLeaveBtn = document.getElementById("cancelLeaveLudo");
    const confirmLeaveBtn = document.getElementById("confirmLeaveLudo");

    if (joinBtn) {
        joinBtn.onclick = openLudoColorPicker;
    }

    if (leaveBtn) {
        leaveBtn.onclick = function () {
            if (leaveModal) {
                leaveModal.hidden = false;
            }
        };
    }

    if (cancelLeaveBtn) {
        cancelLeaveBtn.onclick = function () {
            if (leaveModal) {
                leaveModal.hidden = true;
            }
        };
    }

    if (confirmLeaveBtn) {
        confirmLeaveBtn.onclick = confirmLeaveLudoGame;
    }

    if (startBtn) startBtn.onclick = startLudo;
    if (diceBtn) diceBtn.onclick = rollLudoDice;
}



async function confirmLeaveLudoGame() {

    const button = document.getElementById("confirmLeaveLudo");
    const modal = document.getElementById("leaveLudoModal");

    if (!ludoCurrentRoomId || !button || button.disabled) {
        return;
    }

    button.disabled = true;
    button.textContent = "LEAVING...";

    try {

        const { data, error } = await supabaseClient.rpc(
            "leave_ludo_game",
            {
                p_room_id: ludoCurrentRoomId
            }
        );

        if (error) throw error;

        if (!data || !data.success) {
            throw new Error(data?.message || "Unable to leave Ludo.");
        }

        if (modal) {
            modal.hidden = true;
        }

        await loadLudoGame();

        showLudoMessage("You left the game. You can spectate now.");

    } catch (error) {

        console.error("Leave Ludo error:", error);

        if (modal) {
            modal.hidden = true;
        }

        showLudoMessage(error.message || "Unable to leave Ludo.");

    } finally {

        button.disabled = false;
        button.textContent = "YES, LEAVE";
    }
}


// ==========================================
// TIMER ELEMENT
// ==========================================

function ensureLudoTimerElement() {

    let timer = document.getElementById("ludoTurnTimer");

    if (timer) return timer;

    const status = document.getElementById("ludoStatus");

    if (!status) return null;

    timer = document.createElement("div");

    timer.id = "ludoTurnTimer";
    timer.className = "ludo-turn-timer";
    timer.hidden = true;
    timer.textContent = "⏳ Turn: 01:00";

    status.insertAdjacentElement("afterend", timer);

    return timer;
}


// ==========================================
// STOP TIMER
// ==========================================

function stopLudoTurnTimer() {

    if (ludoTurnTimerInterval) {
        clearInterval(ludoTurnTimerInterval);
        ludoTurnTimerInterval = null;
    }

    ludoTurnTimerDeadline = null;
}


// ==========================================
// START TIMER
// ==========================================

function startLudoTurnTimer() {

    if (ludoTurnTimerInterval) return;

    ludoTurnTimerInterval = setInterval(() => {
        updateLudoTurnTimer();
    }, 1000);

    updateLudoTurnTimer();
}


// ==========================================
// UPDATE TURN TIMER
// ==========================================

function updateLudoTurnTimer() {

    const timer = ensureLudoTimerElement();
    const game = window.ludoGameData;

    if (!timer) return;

    if (!game || game.status !== "playing") {

        stopLudoTurnTimer();

        timer.hidden = true;
        timer.classList.remove("urgent");

        return;
    }

    timer.hidden = false;

    if (
        game.dice_value !== null &&
        game.dice_value !== undefined
    ) {

        stopLudoTurnTimer();

        timer.textContent = "🎲 Waiting for token move";
        timer.classList.remove("urgent");

        return;
    }

    if (!game.turn_deadline_at) {

        stopLudoTurnTimer();

        timer.textContent = "⏳ Starting turn timer...";
        timer.classList.remove("urgent");

        return;
    }

    const deadline = Date.parse(game.turn_deadline_at);

    if (!Number.isFinite(deadline)) {

        stopLudoTurnTimer();

        timer.textContent = "⏳ Starting turn timer...";
        timer.classList.remove("urgent");

        return;
    }

    if (ludoTurnTimerDeadline !== deadline) {

        stopLudoTurnTimer();

        ludoTurnTimerDeadline = deadline;

        ludoTurnTimerInterval = setInterval(() => {
            updateLudoTurnTimer();
        }, 1000);
    }

    const remaining = Math.max(
        0,
        Math.ceil((deadline - Date.now()) / 1000)
    );

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;

    timer.textContent =
        "⏳ Turn: " +
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0");

    timer.classList.toggle("urgent", remaining <= 10);

    if (remaining <= 0) {

        stopLudoTurnTimer();

        triggerLudoTimeout();
    }
}


// ==========================================
// TIMEOUT TURN
// SERVER AUTHORITATIVE
// ==========================================

async function triggerLudoTimeout(force = false) {

    const game = window.ludoGameData;

    if (
        !game ||
        !ludoCurrentRoomId ||
        game.status !== "playing" ||
        game.dice_value !== null ||
        !game.turn_deadline_at
    ) {
        return;
    }

    const timeoutKey =
        game.id + "-" +
        game.current_turn_user_id + "-" +
        game.turn_deadline_at;

    if (!force && Date.parse(game.turn_deadline_at) > Date.now()) {
        return;
    }

    if (ludoTimeoutInFlight || ludoTimeoutKey === timeoutKey) {
        return;
    }

    ludoTimeoutInFlight = true;
    ludoTimeoutKey = timeoutKey;

    try {

        const { data, error } = await supabaseClient.rpc(
            "timeout_ludo_turn",
            {
                p_room_id: ludoCurrentRoomId
            }
        );

        if (error) throw error;

        if (data && data.success) {
            showLudoMessage(
                "⏰ Time up! 5 points deducted. Turn passed."
            );
        }

    } catch (error) {

        console.log("Ludo timeout:", error.message || error);

        ludoTimeoutKey = null;

    } finally {

        ludoTimeoutInFlight = false;

        await loadLudoGame();
    }
}


// ==========================================
// CLEAR AUTO PASS
// ==========================================

function clearLudoAutoPass() {

    if (ludoAutoPassTimer) {
        clearTimeout(ludoAutoPassTimer);
        ludoAutoPassTimer = null;
    }

    ludoAutoPassKey = null;
}


// ==========================================
// LOAD GAME
// ==========================================

async function loadLudoGame() {

    if (!ludoCurrentRoomId) return;

    const requestedRoom = ludoCurrentRoomId;
    const roomVersion = ludoRoomVersion;
    const requestVersion = ++ludoLoadVersion;

    try {

        const { data, error } = await supabaseClient
            .from("ludo_games")
            .select("*")
            .eq("room_id", requestedRoom)
            .maybeSingle();

        if (error) throw error;

        if (
            requestVersion !== ludoLoadVersion ||
            roomVersion !== ludoRoomVersion ||
            requestedRoom !== ludoCurrentRoomId
        ) {
            return;
        }

        if (!data) {

            ludoGameId = null;

            window.ludoGameData = null;
            window.ludoPlayers = [];
            window.ludoHasLeftCurrentGame = false;
            window.ludoLeftInfo = {};
window.ludoLeftColors = [];

            removeLudoRealtime();
            clearLudoAutoPass();
            stopLudoTurnTimer();

            renderLudoPlayers();
            updateLudoDisplay(null);

            if (!ludoAnimatingTokens) {
                renderLudoTokens(null);
            }

            renderLudoWinnerBadge(null);

            return;
        }

        ludoGameId = data.id;
        window.ludoGameData = data;

        const { data: players, error: playersError } =
            await supabaseClient
                .from("ludo_players")
                .select("*")
                .eq("game_id", data.id)
                .order("seat_number");

        if (playersError) throw playersError;

        if (
            requestVersion !== ludoLoadVersion ||
            roomVersion !== ludoRoomVersion ||
            requestedRoom !== ludoCurrentRoomId
        ) {
            return;
        }

        window.ludoPlayers = players || [];




        // Get all players who left this game
const { data: leaveEvents, error: leaveEventsError } =
    await supabaseClient
        .from("ludo_moves")
        .select("user_id, move_data")
        .eq("game_id", data.id)
        .eq("move_type", "player_leave");

if (leaveEventsError) throw leaveEventsError;
window.ludoLeftInfo = {};

(leaveEvents || []).forEach(item => {
    const color = String(item.move_data?.color || "").toLowerCase();

    if (
        LUDO_COLORS.includes(color) &&
        !window.ludoPlayers.some(player => player.player_color === color)
    ) {
        window.ludoLeftInfo[color] = {
    color: color,
    score: Number(item.move_data?.score || 0),
    user_id: item.user_id || null,
    left: true
};
    }
});

window.ludoLeftColors = Object.keys(window.ludoLeftInfo);



        // Check whether current user has previously left this game
        const { data: authData, error: authError } =
            await supabaseClient.auth.getUser();

        if (authError) throw authError;

        let hasLeft = false;

        if (authData?.user) {

            const { data: leaveRecord, error: leaveError } =
                await supabaseClient
                    .from("ludo_game_leaves")
                    .select("user_id")
                    .eq("game_id", data.id)
                    .eq("user_id", authData.user.id)
                    .maybeSingle();

            if (leaveError) throw leaveError;

            hasLeft = Boolean(leaveRecord);
        }

        if (
            requestVersion !== ludoLoadVersion ||
            roomVersion !== ludoRoomVersion ||
            requestedRoom !== ludoCurrentRoomId
        ) {
            return;
        }

        window.ludoHasLeftCurrentGame = hasLeft;

        renderLudoPlayers();
        updateLudoDisplay(data);

        if (!ludoAnimatingTokens) {
            renderLudoTokens(data);
        }

        renderLudoWinnerBadge(data);

        subscribeLudoRealtime(data.id);

        updateLudoTurnTimer();
        updateLudoDiceHand();
        // SHOW FINAL RESULTS WHEN GAME IS FINISHED
if (data.status === "finished") {
    showLudoFinalResults(data);
}

    } catch (error) {

        if (requestVersion !== ludoLoadVersion) return;

        console.error("Ludo game load error:", error);

        showLudoMessage(error.message || "Unable to load game.");

        updateLudoDiceHand();
    }
}


// ==========================================
// LOAD PLAYERS
// ==========================================

async function loadLudoPlayers() {

    if (!ludoGameId) {

        window.ludoPlayers = [];
        renderLudoPlayers();
        updateLudoDiceHand();

        return;
    }

    const gameId = ludoGameId;

    try {

        const { data, error } = await supabaseClient
            .from("ludo_players")
            .select("*")
            .eq("game_id", gameId)
            .order("seat_number");

        if (error) throw error;

        if (gameId !== ludoGameId) return;

        window.ludoPlayers = data || [];

        renderLudoPlayers();
        updateLudoDiceHand();

    } catch (error) {

        console.error("Ludo players error:", error);
    }
}


// ==========================================
// RENDER PLAYER CARDS + SCORE
// ==========================================

function renderLudoPlayers() {
    const playerArea = document.getElementById("ludoPlayers");
    if (!playerArea) return;

    const players = window.ludoPlayers || [];
    const game = window.ludoGameData;
    const leftInfo = window.ludoLeftInfo || {};

    playerArea.innerHTML = "";

    LUDO_COLORS.forEach(color => {
        const player = players.find(item => item.player_color === color);
        const card = document.createElement("div");
        card.className = "ludo-player " + color;

        if (!player) {
            const leftPlayer = leftInfo[color];

            if (leftPlayer) {
                card.classList.add("player-left");

                card.innerHTML = `
                    <span class="player-name">${getLudoPlayerDisplayName(color)} (LEFT)</span>
                    <small>LEFT</small>
                    <small class="ludo-player-score">⭐ ${Number(leftPlayer.score || 0)} Points</small>`;
            } else {
                card.classList.add("player-empty");

                card.innerHTML = `
                   <span class="player-name">${getLudoPlayerDisplayName(color)}</span>
                    <small>Waiting for player</small>`;
            }
        } else {
            const isMe =
                typeof currentUser !== "undefined" &&
                currentUser &&
                player.user_id === currentUser.id;

            const isActive =
                game &&
                game.status === "playing" &&
                game.current_turn_user_id === player.user_id;

            if (isActive) card.classList.add("active-player");

            card.innerHTML = `
<span class="player-name">${getLudoPlayerDisplayName(color)} ${isMe ? " (YOU)" : ""}</span>
                <small>${isActive ? "YOUR TURN" : "PLAYER " + player.seat_number}</small>
                <small class="ludo-player-score">⭐ ${Number(player.score || 0)} Points</small>`;
        }

        playerArea.appendChild(card);
    });
}


// ==========================================
// JOIN GAME
// ==========================================

/*async function joinLudo() {

    if (!ludoCurrentRoomId || ludoBusy) return;

    getLudoAudioContext();

    const button = document.getElementById("joinLudoBtn");

    ludoBusy = true;

    updateLudoDiceHand();

    if (button) button.disabled = true;

    try {

        const { data, error } = await supabaseClient.rpc(
            "join_ludo_game",
            {
                p_room_id: ludoCurrentRoomId
            }
        );

        if (error) throw error;

        if (!data || !data.success) {
            throw new Error(data?.message || "Unable to join Ludo.");
        }

        showLudoMessage(
            "You joined as " + String(data.color || "").toUpperCase()
        );

    } catch (error) {

        console.error("Join Ludo error:", error);

        showLudoMessage(error.message || "Unable to join game.");

    } finally {

        ludoBusy = false;

        await loadLudoGame();

        updateLudoDiceHand();
    }
}*/



// ==========================================
// TOKEN COLOUR SELECTION
// ==========================================

function closeLudoColorPicker() {

    if (ludoColorRefreshTimer) {
        clearInterval(ludoColorRefreshTimer);
        ludoColorRefreshTimer = null;
    }

    const popup = document.getElementById("ludoColorOverlay");

    if (popup) popup.remove();
}


// ==========================================
// OPEN COLOUR PICKER
// ==========================================

async function openLudoColorPicker() {

    if (!ludoCurrentRoomId || ludoBusy) return;

    if (typeof currentUser === "undefined" || !currentUser) {
        showLudoMessage("Please login first.");
        return;
    }

    getLudoAudioContext();

    try {

        const { data: game, error: gameError } = await supabaseClient
            .from("ludo_games")
            .select("id,status")
            .eq("room_id", ludoCurrentRoomId)
            .maybeSingle();

        if (gameError) throw gameError;

        if (game && game.status !== "waiting") {
            showLudoMessage("Game has already started.");
            return;
        }

        let players = [];

        if (game) {

            const { data, error } = await supabaseClient
                .from("ludo_players")
                .select("user_id,player_color")
                .eq("game_id", game.id);

            if (error) throw error;

            players = data || [];
        }

        const alreadyJoined = players.some(
            player => player.user_id === currentUser.id
        );

        if (alreadyJoined) {

            showLudoMessage("You have already joined.");

            await loadLudoGame();

            return;
        }

        if (players.length >= 4) {
            showLudoMessage("Maximum 4 players allowed.");
            return;
        }

        const takenColors = players.map(
            player => player.player_color.toLowerCase()
        );

        // Purana picker band karo
        closeLudoColorPicker();

        // Selected colour abhi assign nahi hua
        let selectedLudoColor = null;

        const overlay = document.createElement("div");

        overlay.id = "ludoColorOverlay";
        overlay.className = "ludo-color-overlay";

        overlay.innerHTML = `
            <div class="ludo-color-modal">

                <h2>⚡ CHOOSE YOUR COLOUR</h2>

                <p>Select your Ludo token colour</p>

                <div class="ludo-color-options">

                    ${LUDO_COLORS.map(color => {

                        const taken = takenColors.includes(color);

                        return `
                            <button
                                type="button"
                                class="ludo-color-option ${color}"
                                data-color="${color}"
                                aria-pressed="false"
                                ${taken ? "disabled" : ""}>

                                <span class="ludo-color-token ${color}"></span>

                                <span class="ludo-color-name">
                                    ${color.toUpperCase()}
                                    ${taken ? " 🔒 TAKEN" : ""}
                                </span>

                                <span class="ludo-color-check">
                                    ✓
                                </span>

                            </button>
                        `;

                    }).join("")}

                </div>

                <button
                    type="button"
                    id="ludoConfirmColor"
                    class="ludo-confirm-color"
                    disabled>
                    CONFIRM COLOUR
                </button>

                <button
                    type="button"
                    class="ludo-color-close"
                    id="ludoColorClose">
                    CANCEL
                </button>

            </div>
        `;

        document.body.appendChild(overlay);

        const confirmButton = document.getElementById(
            "ludoConfirmColor"
        );

        // =================================
        // UPDATE SELECTION UI
        // =================================

        function updateColorSelection() {

            overlay.querySelectorAll(".ludo-color-option").forEach(button => {

                const selected =
                    button.dataset.color === selectedLudoColor;

                button.classList.toggle("selected", selected);

                button.setAttribute(
                    "aria-pressed",
                    selected ? "true" : "false"
                );

            });

            confirmButton.disabled = !selectedLudoColor;
        }

        // =================================
        // REFRESH AVAILABLE COLOURS
        // =================================

        async function refreshLudoColors() {

            if (!document.getElementById("ludoColorOverlay")) return;

            try {

                const { data: latestGame, error: gameError } =
                    await supabaseClient
                        .from("ludo_games")
                        .select("id,status")
                        .eq("room_id", ludoCurrentRoomId)
                        .maybeSingle();

                if (gameError) throw gameError;

                // Game abhi create nahi hua:
                // Picker khula rehne do.
                if (!latestGame) {
                    return;
                }

                // Game start ho gaya
                if (latestGame.status !== "waiting") {

                    closeLudoColorPicker();

                    showLudoMessage("Game has already started.");

                    return;
                }

                const { data: latestPlayers, error } =
                    await supabaseClient
                        .from("ludo_players")
                        .select("user_id,player_color")
                        .eq("game_id", latestGame.id);

                if (error) throw error;

                const currentPlayers = latestPlayers || [];

                // User kisi doosre device se join kar chuka hai
                if (currentPlayers.some(
                    player => player.user_id === currentUser.id
                )) {

                    closeLudoColorPicker();

                    showLudoMessage("You have already joined.");

                    await loadLudoGame();

                    return;
                }

                // Maximum players reached
                if (currentPlayers.length >= 4) {

                    closeLudoColorPicker();

                    showLudoMessage("Maximum 4 players allowed.");

                    return;
                }

                const latestTakenColors = currentPlayers.map(
                    player => player.player_color.toLowerCase()
                );

                // Selected colour kisi aur ne le liya?
                if (
                    selectedLudoColor &&
                    latestTakenColors.includes(selectedLudoColor)
                ) {

                    selectedLudoColor = null;

                    showLudoMessage(
                        "Selected colour has already been taken. Choose another."
                    );
                }

                // Update available/taken colours
                overlay.querySelectorAll(".ludo-color-option").forEach(button => {

                    const color = button.dataset.color;

                    const taken = latestTakenColors.includes(color);

                    button.disabled = taken;

                    const name = button.querySelector(".ludo-color-name");

                    if (name) {

                        name.textContent =
                            color.toUpperCase() +
                            (taken ? " 🔒 TAKEN" : "");

                    }

                });

                updateColorSelection();

            } catch (error) {

                console.error("Colour refresh error:", error);

            }
        }

        // =================================
        // SELECT COLOUR
        // =================================

        overlay.querySelectorAll(".ludo-color-option").forEach(button => {

            button.addEventListener("click", function() {

                if (this.disabled || ludoBusy) return;

                const color = this.dataset.color;

                if (!LUDO_COLORS.includes(color)) return;

                // Sirf select hoga, join nahi hoga
                selectedLudoColor = color;

                updateColorSelection();

            });

        });

        // =================================
        // CONFIRM COLOUR
        // =================================

        confirmButton.addEventListener("click", async function() {

            if (!selectedLudoColor || ludoBusy) return;

            const finalColor = selectedLudoColor;

            if (!LUDO_COLORS.includes(finalColor)) return;

            confirmButton.disabled = true;

            confirmButton.textContent = "JOINING...";

            overlay.querySelectorAll(".ludo-color-option").forEach(button => {
                button.disabled = true;
            });

            // Confirm ke baad hi colour assign hoga
            closeLudoColorPicker();

            await joinLudo(finalColor);

        });

        // =================================
        // CANCEL
        // =================================

        document.getElementById("ludoColorClose").onclick =
            closeLudoColorPicker;

        overlay.addEventListener("click", function(event) {

            if (event.target === overlay) {
                closeLudoColorPicker();
            }

        });

        // =================================
        // START LIVE COLOUR REFRESH
        // =================================

        await refreshLudoColors();

        if (document.getElementById("ludoColorOverlay")) {

            ludoColorRefreshTimer = setInterval(
                refreshLudoColors,
                700
            );

        }

    } catch (error) {

        console.error("Colour selection error:", error);

        showLudoMessage(
            error.message || "Unable to load colours."
        );

    }
}

// ==========================================
// JOIN GAME WITH SELECTED COLOUR
// ==========================================

async function joinLudo(selectedColor) {

    if (!ludoCurrentRoomId || ludoBusy) return;

    if (!LUDO_COLORS.includes(selectedColor)) return;

    const button = document.getElementById("joinLudoBtn");

    ludoBusy = true;

    updateLudoDiceHand();

    if (button) button.disabled = true;

    try {

        const { data, error } = await supabaseClient.rpc(
            "join_ludo_game",
            {
                p_room_id: ludoCurrentRoomId,
                p_color: selectedColor
            }
        );

        if (error) throw error;

        if (!data || !data.success) {

            throw new Error(
                data?.message || "Unable to join Ludo."
            );
        }

        showLudoMessage(
            "🎉 You joined as " +
            String(data.color || selectedColor).toUpperCase()
        );

    } catch (error) {

        console.error("Join Ludo error:", error);

        showLudoMessage(
            error.message || "Unable to join game."
        );

    } finally {

        ludoBusy = false;

        await loadLudoGame();

        updateLudoDiceHand();
    }
}

// ==========================================
// START GAME
// ==========================================

async function startLudo() {

    if (!ludoGameId || ludoBusy) return;

    const players = window.ludoPlayers || [];

    if (players.length < 2) {
        showLudoMessage("At least 2 players are required.");
        return;
    }

    const gameId = ludoGameId;
    const button = document.getElementById("startLudoBtn");

    ludoBusy = true;

    updateLudoDiceHand();

    if (button) button.disabled = true;

    try {

        const { data, error } = await supabaseClient.rpc(
            "start_ludo_game",
            {
                p_game_id: gameId
            }
        );

        if (error) throw error;

        if (!data || !data.success) {
            throw new Error(data?.message || "Unable to start game.");
        }

        showLudoMessage("Game started! Red player goes first.");

    } catch (error) {

        console.error("Start Ludo error:", error);

        showLudoMessage(error.message || "Unable to start game.");

    } finally {

        ludoBusy = false;

        await loadLudoGame();

        updateLudoDiceHand();
    }
}


// ==========================================
// BOARD COORDINATES
// ==========================================

const LUDO_MAIN_PATH = [

    [6,1], [6,2], [6,3], [6,4], [6,5],
    [5,6], [4,6], [3,6], [2,6], [1,6],
    [0,6], [0,7], [0,8],

    [1,8], [2,8], [3,8], [4,8], [5,8],
    [6,9], [6,10], [6,11], [6,12], [6,13],
    [6,14], [7,14], [8,14],

    [8,13], [8,12], [8,11], [8,10], [8,9],
    [9,8], [10,8], [11,8], [12,8], [13,8],
    [14,8], [14,7], [14,6],

    [13,6], [12,6], [11,6], [10,6], [9,6],
    [8,5], [8,4], [8,3], [8,2], [8,1],
    [8,0], [7,0], [6,0]
];


// ==========================================
// OFFSETS
// ==========================================

const LUDO_OFFSETS = {
    red: 0,
    green: 13,
    yellow: 26,
    blue: 39
};


// ==========================================
// HOME PATHS
// ==========================================

const LUDO_HOME_PATHS = {

    red: [
        [7,1], [7,2], [7,3],
        [7,4], [7,5], [7,6]
    ],

    green: [
        [1,7], [2,7], [3,7],
        [4,7], [5,7], [6,7]
    ],

    yellow: [
        [7,13], [7,12], [7,11],
        [7,10], [7,9], [7,8]
    ],

    blue: [
        [13,7], [12,7], [11,7],
        [10,7], [9,7], [8,7]
    ]
};


// ==========================================
// SAFE CELLS
// ==========================================

const LUDO_SAFE_CELLS = [
    0, 8, 13, 21,
    26, 34, 39, 47
];


// ==========================================
// TOKEN CLUSTER POSITIONING
// ==========================================

function positionTokensInCell(cell) {

    if (!cell) return;

    const tokens = Array.from(
        cell.querySelectorAll(":scope > .ludo-token")
    );

    const positions = [
        [50, 50],
        [30, 50],
        [70, 50],
        [30, 30],
        [70, 30],
        [50, 70],
        [30, 70],
        [70, 70]
    ];

    tokens.forEach((token, index) => {

        const position = positions[index % positions.length];

        token.style.position = "absolute";
        token.style.left = position[0] + "%";
        token.style.top = position[1] + "%";
        token.style.transform = "translate(-50%, -50%)";
        token.style.margin = "0";
        token.style.zIndex = String(10 + index);
    });
}


// ==========================================
// FINISHED TOKEN CONTAINER
// ==========================================

function ensureLudoFinishedContainer() {

    const center = document.querySelector(
        "#ludoBoard .ludo-center"
    );

    if (!center) return null;

    let container = center.querySelector(
        ".ludo-finished-tokens"
    );

    if (container) return container;

    container = document.createElement("div");

    container.className = "ludo-finished-tokens";

    LUDO_COLORS.forEach(color => {

        const group = document.createElement("div");

        group.className = "ludo-finished-group";
        group.dataset.color = color;

        container.appendChild(group);
    });

    center.appendChild(container);

    return container;
}


function getLudoFinishedGroup(color) {

    const container = ensureLudoFinishedContainer();

    if (!container) return null;

    return container.querySelector(
        '.ludo-finished-group[data-color="' + color + '"]'
    );
}


// ==========================================
// BOARD CLICK EVENTS
// ==========================================

function attachLudoBoardClickEvents() {

    const board = document.getElementById("ludoBoard");

    if (!board || board.dataset.tokenEventsAttached) return;

    board.addEventListener("click", function(event) {

        const token = event.target.closest(".ludo-token");

        if (token) {

            if (!token.classList.contains("is-movable")) return;

            const tokenIndex = Number(token.dataset.token);

            if (Number.isInteger(tokenIndex)) {
                window.moveLudoToken(tokenIndex);
            }

            return;
        }

        const cell = event.target.closest(".track-cell");

        if (!cell) return;

        const movableToken = cell.querySelector(
            ".ludo-token.is-movable"
        );

        if (!movableToken) return;

        const tokenIndex = Number(movableToken.dataset.token);

        if (Number.isInteger(tokenIndex)) {
            window.moveLudoToken(tokenIndex);
        }
    });

    board.dataset.tokenEventsAttached = "true";
}


// ==========================================
// BUILD BOARD
// ==========================================

function buildLudoBoard() {

    const track = document.getElementById("ludoTrack");

    if (!track) {
        console.error("Ludo track not found.");
        return;
    }

    track.innerHTML = "";

    LUDO_MAIN_PATH.forEach((coordinate, index) => {

        const cell = document.createElement("div");

        cell.className = "track-cell";
        cell.id = "ludo-main-" + index;

        cell.style.gridRow = String(coordinate[0] + 1);
        cell.style.gridColumn = String(coordinate[1] + 1);

        if (LUDO_SAFE_CELLS.includes(index)) {
            cell.classList.add("safe-cell");
        }

        if (index === 0) cell.classList.add("red-path");
        if (index === 13) cell.classList.add("green-path");
        if (index === 26) cell.classList.add("yellow-path");
        if (index === 39) cell.classList.add("blue-path");

        track.appendChild(cell);
    });

    LUDO_COLORS.forEach(color => {

        LUDO_HOME_PATHS[color].forEach((coordinate, index) => {

            const cell = document.createElement("div");

            cell.className =
                "track-cell " + color + "-path home-path-cell";

            cell.id =
                "ludo-home-" + color + "-" + (index + 52);

            cell.style.gridRow = String(coordinate[0] + 1);
            cell.style.gridColumn = String(coordinate[1] + 1);

            if (index === 5) {
                cell.classList.add("home-finish-cell");
            }

            track.appendChild(cell);
        });
    });

    attachLudoBoardClickEvents();
    ensureLudoFinishedContainer();
}


// ==========================================
// TOKEN POSITION
// ==========================================

function getLudoTokenPosition(color, tokenIndex, game) {

    if (!game || !game.game_state) return -1;

    const tokens = game.game_state[color];

    if (!Array.isArray(tokens)) return -1;

    const rawPosition = tokens[tokenIndex];

    if (
        rawPosition === null ||
        rawPosition === undefined ||
        rawPosition === ""
    ) {
        return -1;
    }

    const position = Number(rawPosition);

    if (
        !Number.isInteger(position) ||
        position < -1 ||
        position > 57
    ) {
        return -1;
    }

    return position;
}


// ==========================================
// MAIN TRACK CELL
// UPDATED NUMBERING
//
// 0 = Physical box before starting box
// 1 = Starting box
// 1 TO 51 = Normal playable track
// ==========================================

function getLudoMainCell(position, color) {

    if (position < 0 || position > 51) return null;

    const offset = LUDO_OFFSETS[color];

    if (offset === undefined) return null;

    // Position 1 maps to the color's starting square.
    // Position 0 maps to the physical square before it.

    const globalPosition =
        (position + offset + 51) % 52;

    return document.getElementById(
        "ludo-main-" + globalPosition
    );
}


// ==========================================
// HOME CELL
// ==========================================

function getLudoHomeCell(position, color) {

    if (position < 52 || position > 56) return null;

    return document.getElementById(
        "ludo-home-" + color + "-" + position
    );
}


// ==========================================
// BASE CONTAINER
// ==========================================

function getLudoBase(color) {

    return document.getElementById(
        color + "HomeTokens"
    );
}


// ==========================================
// PLACE TOKEN
// ==========================================

function placeLudoTokenAtPosition(token, color, position) {

    if (!token) return;

    let targetCell = null;

    token.classList.remove("is-finished-token");

    // BASE
    if (position === -1) {

        targetCell = getLudoBase(color);

        if (!targetCell) return;

        token.style.position = "";
        token.style.left = "";
        token.style.top = "";
        token.style.transform = "";
        token.style.margin = "";
        token.style.zIndex = "";

        targetCell.appendChild(token);

        return;
    }

    // MAIN TRACK: 0 TO 51

    if (position >= 0 && position <= 51) {

        targetCell = getLudoMainCell(position, color);

    }

    // HOME LANE: 52 TO 56

    else if (position >= 52 && position <= 56) {

        targetCell = getLudoHomeCell(position, color);

    }

    // FINISHED: 57

    else if (position === 57) {

        targetCell = getLudoFinishedGroup(color);
    }

    if (!targetCell) return;

    if (position === 57) {

        token.classList.add("is-finished-token");

        token.style.position = "relative";
        token.style.left = "auto";
        token.style.top = "auto";
        token.style.transform = "none";
        token.style.margin = "0";
        token.style.zIndex = "1";
    }

    targetCell.appendChild(token);

    if (position !== 57) {
        positionTokensInCell(targetCell);
    }
}


// ==========================================
// RENDER TOKENS
// ==========================================

function renderLudoTokens(game = null) {
    const board = document.getElementById("ludoBoard");
    if (!board) return;

    if (!document.getElementById("ludo-main-0")) {
        buildLudoBoard();
    }

    ensureLudoFinishedContainer();

    const leftColors = window.ludoLeftColors || [];

    LUDO_COLORS.forEach(color => {

        // LEFT label sirf usi player ke HOME mein
        const homeInner = document.querySelector(
            `#ludoGame .${color}-home .home-inner`
        );

        if (homeInner) {
            let label = homeInner.querySelector(".ludo-left-label");

            if (!label) {
                label = document.createElement("span");
                label.className = "ludo-left-label";
                label.textContent = "LEFT";
                homeInner.appendChild(label);
            }

            label.hidden = !leftColors.includes(color);
        }

        // Player ke 4 tokens HOME mein wapas
        for (let index = 0; index < 4; index++) {

            const token = document.querySelector(
                '.ludo-token[data-color="' + color + '"][data-token="' + index + '"]'
            );

            if (!token) continue;

            token.classList.remove("is-movable");
            token.disabled = true;
            token.style.pointerEvents = "auto";
            token.setAttribute(
                "aria-label",
                color + " token " + (index + 1)
            );

            const position = leftColors.includes(color)
                ? -1
                : getLudoTokenPosition(color, index, game);

            placeLudoTokenAtPosition(token, color, position);
        }
    });

    updateLudoMovableTokens(game);
}


// ==========================================
// WINNER BADGE
// ==========================================

function renderLudoWinnerBadge(game) {

    document.querySelectorAll(".ludo-winner-badge").forEach(
        badge => badge.remove()
    );

    if (!game || game.status !== "finished") return;

    let winnerColor = null;

    // 1. Normal game victory
    if (game.game_state) {

        LUDO_COLORS.forEach(color => {

            const tokens = game.game_state[color];

            if (
                Array.isArray(tokens) &&
                tokens.length === 4 &&
                tokens.every(position => Number(position) === 57)
            ) {
                winnerColor = color;
            }
        });
    }

    // 2. Opponents leave karne par remaining player winner
    if (!winnerColor && game.current_turn_user_id) {

        const winner = (window.ludoPlayers || []).find(
            player => player.user_id === game.current_turn_user_id
        );

        if (winner) {
            winnerColor = winner.player_color;
        }
    }

    if (!winnerColor) return;

    const base = getLudoBase(winnerColor);

    if (!base) return;

    const parent = base.parentElement || base;

    const badge = document.createElement("div");

    badge.className = "ludo-winner-badge";
    badge.textContent = "🏆 1st WINNER";

    parent.appendChild(badge);
}

// ==========================================
// MY PLAYER
// ==========================================

function getMyLudoPlayer() {

    if (
        typeof currentUser === "undefined" ||
        !currentUser
    ) {
        return null;
    }

    return (window.ludoPlayers || []).find(
        player => player.user_id === currentUser.id
    ) || null;
}


// ==========================================
// DICE HAND VISIBILITY
// ==========================================

function updateLudoDiceHand() {

    const diceButton = document.getElementById("ludoDice");

    if (!diceButton) return;

    const game = window.ludoGameData;
    const myPlayer = getMyLudoPlayer();

    const isMyTurn =
        Boolean(game) &&
        Boolean(myPlayer) &&
        typeof currentUser !== "undefined" &&
        currentUser &&
        game.status === "playing" &&
        game.current_turn_user_id === currentUser.id;

    const deadlineValid =
        !game ||
        !game.turn_deadline_at ||
        Date.parse(game.turn_deadline_at) > Date.now();

    const canRollDice =
        isMyTurn &&
        deadlineValid &&
        (game.dice_value === null || game.dice_value === undefined) &&
        !ludoBusy &&
        !ludoDiceRolling &&
        !ludoAnimatingTokens &&
        !diceButton.disabled;

    diceButton.classList.toggle(
        "is-current-turn",
        Boolean(canRollDice)
    );
}


// ==========================================
// CURRENT PLAYER
// ==========================================

function getCurrentLudoPlayer(game) {

    if (!game) return null;

    return (window.ludoPlayers || []).find(
        player => player.user_id === game.current_turn_user_id
    ) || null;
}


// ==========================================
// AUDIO CONTEXT
// ==========================================

function getLudoAudioContext() {

    const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

    if (!AudioContextClass) return null;

    if (!ludoAudioContext) {
        ludoAudioContext = new AudioContextClass();
    }

    if (ludoAudioContext.state === "suspended") {
        ludoAudioContext.resume().catch(() => {});
    }

    return ludoAudioContext;
}


// ==========================================
// DICE SOUND
// ==========================================

function playLudoDiceSound() {

    try {

        const ctx = getLudoAudioContext();

        if (!ctx) return;

        const start = ctx.currentTime;

        for (let i = 0; i < 9; i++) {

            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();

            const time = start + i * 0.075;

            oscillator.type = "triangle";

            oscillator.frequency.setValueAtTime(
                250 + Math.random() * 500,
                time
            );

            gain.gain.setValueAtTime(0.0001, time);

            gain.gain.exponentialRampToValueAtTime(
                0.12,
                time + 0.01
            );

            gain.gain.exponentialRampToValueAtTime(
                0.0001,
                time + 0.055
            );

            oscillator.connect(gain);
            gain.connect(ctx.destination);

            oscillator.start(time);
            oscillator.stop(time + 0.06);
        }

    } catch (error) {
        console.log("Dice sound error:", error);
    }
}


// ==========================================
// TOKEN SOUND
// ==========================================

function playLudoStepSound() {

    try {

        const ctx = getLudoAudioContext();

        if (!ctx) return;

        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        oscillator.type = "sine";

        oscillator.frequency.setValueAtTime(
            520,
            ctx.currentTime
        );

        oscillator.frequency.exponentialRampToValueAtTime(
            300,
            ctx.currentTime + 0.07
        );

        gain.gain.setValueAtTime(
            0.0001,
            ctx.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
            0.09,
            ctx.currentTime + 0.008
        );

        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            ctx.currentTime + 0.09
        );

        oscillator.connect(gain);
        gain.connect(ctx.destination);

        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.1);

    } catch (error) {
        console.log("Token sound error:", error);
    }
}


// ==========================================
// CAPTURE SOUND - SNAKE HISS
// ==========================================

function playLudoCaptureSound() {

    try {

        const ctx = getLudoAudioContext();

        if (!ctx) return;

        const duration = 0.85;
        const bufferSize = Math.floor(
            ctx.sampleRate * duration
        );

        const buffer = ctx.createBuffer(
            1,
            bufferSize,
            ctx.sampleRate
        );

        const channel = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {

            const fade = Math.sin(
                Math.PI * i / bufferSize
            );

            channel[i] =
                (Math.random() * 2 - 1) * fade;
        }

        const source = ctx.createBufferSource();
        const highPass = ctx.createBiquadFilter();
        const bandPass = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        source.buffer = buffer;

        highPass.type = "highpass";
        highPass.frequency.value = 1500;

        bandPass.type = "bandpass";
        bandPass.frequency.value = 3200;
        bandPass.Q.value = 0.7;

        gain.gain.setValueAtTime(0.0001, ctx.currentTime);

        gain.gain.exponentialRampToValueAtTime(
            0.22,
            ctx.currentTime + 0.08
        );

        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            ctx.currentTime + duration
        );

        source.connect(highPass);
        highPass.connect(bandPass);
        bandPass.connect(gain);
        gain.connect(ctx.destination);

        source.start();

    } catch (error) {
        console.log("Capture sound error:", error);
    }
}


// ==========================================
// TOKEN FINISH MUSIC
// ==========================================

function playLudoFinishMusic() {

    try {

        const ctx = getLudoAudioContext();

        if (!ctx) return;

        const notes = [
            523.25,
            659.25,
            783.99
        ];

        notes.forEach((frequency, index) => {

            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();

            const time = ctx.currentTime + index * 0.13;

            oscillator.type = "sine";

            oscillator.frequency.setValueAtTime(
                frequency,
                time
            );

            gain.gain.setValueAtTime(0.0001, time);

            gain.gain.exponentialRampToValueAtTime(
                0.045,
                time + 0.025
            );

            gain.gain.exponentialRampToValueAtTime(
                0.0001,
                time + 0.30
            );

            oscillator.connect(gain);
            gain.connect(ctx.destination);

            oscillator.start(time);
            oscillator.stop(time + 0.31);
        });

    } catch (error) {
        console.log("Finish music error:", error);
    }
}


// ==========================================
// TOKEN FINISH CELEBRATION
// ==========================================

function showLudoFinishCelebration(color) {

    const board = document.getElementById("ludoBoard");

    if (!board) return;

    const effect = document.createElement("div");

    effect.className = "ludo-finish-effect";

    effect.textContent =
        "✨ " + color.toUpperCase() + " TOKEN FINISHED! ✨";

    board.appendChild(effect);

    playLudoFinishMusic();

    setTimeout(() => {
        effect.remove();
    }, 1700);
}


// ==========================================
// WAIT
// ==========================================

function waitLudo(ms) {

    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}


// ==========================================
// DICE ROTATIONS
// ==========================================

const LUDO_DICE_ROTATIONS = {

    1: { x: 0, y: 0 },
    2: { x: -90, y: 0 },
    3: { x: 0, y: -90 },
    4: { x: 0, y: 90 },
    5: { x: 90, y: 0 },
    6: { x: 0, y: 180 }
};


// ==========================================
// SET DICE FACE
// ==========================================

function setLudoDiceFace(value, animate = true) {

    const cube = document.getElementById("diceCube");

    if (!cube) return;

    const rotation = LUDO_DICE_ROTATIONS[value];

    if (!rotation) return;

    const finalX = rotation.x + 720;
    const finalY = rotation.y + 720;

    const transform =
        "rotateX(" + finalX + "deg) " +
        "rotateY(" + finalY + "deg)";

    cube.style.transition = animate
        ? "transform 0.55s cubic-bezier(.2,.8,.2,1)"
        : "none";

    cube.style.transform = transform;
    cube.dataset.value = String(value);

    cube.setAttribute(
        "aria-label",
        "Dice value " + value
    );
}


// ==========================================
// SHOW DICE
// ==========================================

function showLudoDice(value) {

    value = Number(value);

    if (!Number.isInteger(value) || value < 1 || value > 6) {
        return;
    }

    if (ludoDiceRolling) {
        ludoPendingDiceValue = value;
        return;
    }

    setLudoDiceFace(value);
}


// ==========================================
// RESET DICE
// ==========================================

function resetLudoDice() {

    const cube = document.getElementById("diceCube");

    if (!cube || ludoDiceRolling) return;

    ludoPendingDiceValue = null;

    cube.dataset.value = "";

    cube.style.transition = "transform 0.4s ease";

    cube.style.transform =
        "rotateX(-15deg) rotateY(-15deg)";

    cube.setAttribute(
        "aria-label",
        "Roll the dice"
    );
}


// ==========================================
// START DICE ROLL
// ==========================================

function startLudoDiceAnimation() {

    const button = document.getElementById("ludoDice");
    const cube = document.getElementById("diceCube");

    ludoDiceRolling = true;
    ludoPendingDiceValue = null;

    updateLudoDiceHand();

    const startTime = Date.now();

    if (button) {
        button.classList.add("rolling");
    }

    if (cube) {

        cube.style.transition = "none";
        cube.style.transform = "rotateX(0deg) rotateY(0deg)";

        if (typeof cube.animate === "function") {

            const animation = cube.animate(
                [
                    { transform: "rotateX(0deg) rotateY(0deg)" },
                    { transform: "rotateX(360deg) rotateY(270deg)" },
                    { transform: "rotateX(720deg) rotateY(540deg)" },
                    { transform: "rotateX(1080deg) rotateY(900deg)" }
                ],
                {
                    duration: 1000,
                    easing: "cubic-bezier(.15,.75,.25,1)",
                    fill: "none"
                }
            );

            cube._ludoAnimation = animation;
        }
    }

    playLudoDiceSound();

    return startTime;
}


// ==========================================
// FINISH DICE ROLL
// ==========================================

async function finishLudoDiceAnimation(value, startTime) {

    const button = document.getElementById("ludoDice");
    const cube = document.getElementById("diceCube");

    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, 1000 - elapsed);

    if (remaining > 0) {
        await waitLudo(remaining);
    }

    if (cube && cube._ludoAnimation) {
        cube._ludoAnimation.cancel();
        cube._ludoAnimation = null;
    }

    if (button) {
        button.classList.remove("rolling");
    }

    await new Promise(resolve => {

        requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
        });

    });

    ludoDiceRolling = false;

    updateLudoDiceHand();

    setLudoDiceFace(value, true);

    await waitLudo(500);
}


// ==========================================
// ROLL DICE
// ==========================================

async function rollLudoDice() {

    if (!ludoCurrentRoomId || ludoBusy) return;

    const button = document.getElementById("ludoDice");
    const roomId = ludoCurrentRoomId;

    ludoBusy = true;

    if (button) button.disabled = true;

    updateLudoDiceHand();

    let animationStart = null;

    try {

        animationStart = startLudoDiceAnimation();

        const { data, error } = await supabaseClient.rpc(
            "roll_ludo_dice",
            {
                p_room_id: roomId
            }
        );

        if (error) throw error;

        if (!data || !data.success) {
            throw new Error(
                data?.message || "Dice could not be rolled."
            );
        }

        const diceValue = Number(data.dice);

        if (
            !Number.isInteger(diceValue) ||
            diceValue < 1 ||
            diceValue > 6
        ) {
            throw new Error("Invalid dice value received.");
        }

        await finishLudoDiceAnimation(
            diceValue,
            animationStart
        );

        showLudoMessage("🎲 You rolled " + diceValue + "!");

    } catch (error) {

        console.error("Ludo dice error:", error);

        const cube = document.getElementById("diceCube");

        if (cube && cube._ludoAnimation) {
            cube._ludoAnimation.cancel();
            cube._ludoAnimation = null;
        }

        const diceButton = document.getElementById("ludoDice");

        if (diceButton) {
            diceButton.classList.remove("rolling");
        }

        ludoDiceRolling = false;

        if (
            String(error.message || "")
                .toLowerCase()
                .includes("turn time expired")
        ) {

            showLudoMessage("⏰ Turn time expired.");

            await triggerLudoTimeout(true);

        } else {

            showLudoMessage(
                error.message || "Unable to roll dice."
            );
        }

    } finally {

        ludoDiceRolling = false;
        ludoBusy = false;

        await loadLudoGame();

        updateLudoDiceHand();
    }
}


// ==========================================
// CHECK LEGAL MOVE
// ==========================================

function canLudoTokenMove(
    color,
    tokenIndex,
    diceValue,
    game
) {

    if (!game || !game.game_state) return false;

    if (!Number.isInteger(diceValue)) return false;

    if (diceValue < 1 || diceValue > 6) return false;

    const position = getLudoTokenPosition(
        color,
        tokenIndex,
        game
    );

    // BASE (-1): only six can bring token out.
    // Token enters directly at position 1.

    if (position === -1) {
        return diceValue === 6;
    }

    if (position === 57) return false;

    // Position 0 is only the physical reference box.
    // It is not a normal playable token position.

    if (position === 0) return false;

    // Positions 1-51: normal track.
    // Positions 52-56: home lane.
    // Position 57: finished.

    return (
        position >= 1 &&
        position <= 56 &&
        position + diceValue <= 57
    );
}


// ==========================================
// UPDATE MOVABLE TOKENS
// ==========================================

function updateLudoMovableTokens(game) {

    if (!game) {
        window.ludoAutoMoveKey = null;
        clearTimeout(window.ludoAutoMoveTimer);
        updateLudoDiceHand();
        return;
    }

    const myPlayer = getMyLudoPlayer();
    const diceValue = Number(game.dice_value);

    const hasDice =
        game.dice_value !== null &&
        game.dice_value !== undefined &&
        Number.isInteger(diceValue) &&
        diceValue >= 1 &&
        diceValue <= 6;

    const isMyTurn =
        Boolean(myPlayer) &&
        game.status === "playing" &&
        typeof currentUser !== "undefined" &&
        currentUser &&
        game.current_turn_user_id === currentUser.id;

    const myColor = myPlayer?.player_color;

    const legalTokens = [];
    const homeTokens = [];
    const outsideTokens = [];

    LUDO_COLORS.forEach(color => {

        for (let index = 0; index < 4; index++) {

            const token = document.querySelector(
                '.ludo-token[data-color="' +
                color +
                '"][data-token="' +
                index +
                '"]'
            );

            if (!token) continue;

            const position = getLudoTokenPosition(
                color,
                index,
                game
            );

            const movable =
                Boolean(isMyTurn) &&
                color === myColor &&
                hasDice &&
                canLudoTokenMove(
                    color,
                    index,
                    diceValue,
                    game
                );

            token.classList.toggle("is-movable", movable);
            token.disabled = !movable;

            if (movable) {

                legalTokens.push(index);

                if (position === -1) {
                    homeTokens.push(index);
                } else {
                    outsideTokens.push(index);
                }
            }
        }
    });

    updateLudoDiceHand();

    // ==========================================
    // RESET OLD AUTOMATION AFTER DICE IS CLEARED
    // ==========================================

    if (!hasDice || !isMyTurn) {

        window.ludoAutoMoveKey = null;

        clearTimeout(window.ludoAutoMoveTimer);
        window.ludoAutoMoveTimer = null;

        clearLudoAutoPass();

        return;
    }

    // ==========================================
    // AUTOMATIC TOKEN SELECTION
    // ==========================================

    let automaticToken = null;

    // 6 aaya, HOME mein token hai,
    // aur koi outside token 6 par nahi chal sakta.

    if (
        diceValue === 6 &&
        homeTokens.length > 0 &&
        outsideTokens.length === 0
    ) {

        automaticToken = homeTokens[0];

    }

    // Sirf ek legal token available hai.

    else if (legalTokens.length === 1) {

        automaticToken = legalTokens[0];

    }

    // ==========================================
    // AUTOMATIC MOVEMENT
    // ==========================================

    if (automaticToken !== null) {

        clearLudoAutoPass();

        const autoMoveKey =
            game.id + "-" +
            currentUser.id + "-" +
            diceValue + "-" +
            automaticToken;

        if (window.ludoAutoMoveKey === autoMoveKey) {
            return;
        }

        window.ludoAutoMoveKey = autoMoveKey;

        clearTimeout(window.ludoAutoMoveTimer);

        const selectedToken = automaticToken;
        const selectedGameId = game.id;

        const tryAutomaticMove = async () => {

            // Current game check

            if (
                ludoGameId !== selectedGameId ||
                !window.ludoGameData ||
                window.ludoGameData.status !== "playing" ||
                Number(window.ludoGameData.dice_value) !== diceValue ||
                window.ludoGameData.current_turn_user_id !== currentUser.id
            ) {

                window.ludoAutoMoveKey = null;
                window.ludoAutoMoveTimer = null;

                return;
            }

            // Busy hone par retry

            if (
                ludoBusy ||
                ludoAnimatingTokens ||
                ludoDiceRolling
            ) {

                window.ludoAutoMoveTimer = setTimeout(
                    tryAutomaticMove,
                    250
                );

                return;
            }

            // Latest game state se token dobara verify karo

            const latestGame = window.ludoGameData;

            if (
                !canLudoTokenMove(
                    myColor,
                    selectedToken,
                    diceValue,
                    latestGame
                )
            ) {

                window.ludoAutoMoveKey = null;
                window.ludoAutoMoveTimer = null;

                return;
            }

            window.ludoAutoMoveTimer = null;

            await window.moveLudoToken(selectedToken);
        };

        window.ludoAutoMoveTimer = setTimeout(
            tryAutomaticMove,
            250
        );

        return;
    }

    // ==========================================
    // MULTIPLE TOKENS - PLAYER CHOICE
    // ==========================================

    window.ludoAutoMoveKey = null;

    clearTimeout(window.ludoAutoMoveTimer);
    window.ludoAutoMoveTimer = null;

    // ==========================================
    // NO LEGAL MOVE - AUTO PASS
    // ==========================================

    if (legalTokens.length === 0) {

        const passKey =
            game.id + "-" +
            currentUser.id + "-" +
            diceValue;

        if (ludoAutoPassKey !== passKey) {

            clearLudoAutoPass();

            ludoAutoPassKey = passKey;

            showLudoMessage(
                "No legal move available. Passing turn..."
            );

            scheduleLudoAutoPass(passKey);
        }

    } else {

        clearLudoAutoPass();
    }
}

// ==========================================
// SCHEDULE AUTO PASS
// ==========================================

function scheduleLudoAutoPass(passKey) {

    if (ludoAutoPassTimer) {
        clearTimeout(ludoAutoPassTimer);
    }

    ludoAutoPassTimer = setTimeout(async () => {

        ludoAutoPassTimer = null;

        if (passKey !== ludoAutoPassKey) return;

        if (!window.ludoGameData) return;

        if (
            ludoBusy ||
            ludoLoading ||
            ludoAnimatingTokens ||
            ludoDiceRolling
        ) {
            scheduleLudoAutoPass(passKey);
            return;
        }

        const game = window.ludoGameData;

        if (
            game.status !== "playing" ||
            game.dice_value === null ||
            game.dice_value === undefined
        ) {
            clearLudoAutoPass();
            return;
        }

        await passLudoTurn();

    }, 900);
}


// ==========================================
// ANIMATE TOKEN MOVEMENT
// UPDATED NUMBERING
// ==========================================

async function animateLudoTokenMove(
    color,
    tokenIndex,
    oldPosition,
    diceValue
) {

    const token = document.querySelector(
        '.ludo-token[data-color="' +
        color +
        '"][data-token="' +
        tokenIndex +
        '"]'
    );

    if (!token) return;

    const animationId = ++ludoMoveAnimationId;

    ludoAnimatingTokens = true;

    updateLudoDiceHand();

    // BASE (-1) + SIX = DIRECTLY POSITION 1

    if (oldPosition === -1) {

        placeLudoTokenAtPosition(
            token,
            color,
            1
        );

        playLudoStepSound();

        await waitLudo(350);

        return;
    }

    const finalPosition = oldPosition + diceValue;

    for (
        let position = oldPosition + 1;
        position <= finalPosition;
        position++
    ) {

        if (animationId !== ludoMoveAnimationId) return;

        placeLudoTokenAtPosition(
            token,
            color,
            position
        );

        playLudoStepSound();

        await waitLudo(220);
    }
}


// ==========================================
// MOVE TOKEN
// ==========================================

window.moveLudoToken = async function(tokenIndex) {

    if (!ludoCurrentRoomId || ludoBusy) return;

    if (
        !Number.isInteger(tokenIndex) ||
        tokenIndex < 0 ||
        tokenIndex > 3
    ) {
        return;
    }

    const game = window.ludoGameData;
    const myPlayer = getMyLudoPlayer();

    if (!game || !myPlayer) return;

    if (
        game.status !== "playing" ||
        game.current_turn_user_id !== currentUser.id
    ) {
        return;
    }

    const diceValue = Number(game.dice_value);
    const color = myPlayer.player_color;

    const oldPosition = getLudoTokenPosition(
        color,
        tokenIndex,
        game
    );

    if (
        !canLudoTokenMove(
            color,
            tokenIndex,
            diceValue,
            game
        )
    ) {
        showLudoMessage("This token cannot move.");
        return;
    }

    const roomId = ludoCurrentRoomId;
    const gameId = game.id;

    ludoBusy = true;
    ludoAnimatingTokens = true;

    updateLudoDiceHand();
    clearLudoAutoPass();

    try {

        const { data, error } = await supabaseClient.rpc(
            "move_ludo_token",
            {
                p_room_id: roomId,
                p_token_index: tokenIndex
            }
        );

        if (error) throw error;

        if (!data || !data.success) {
            throw new Error(
                data?.message || "Token movement failed."
            );
        }

        if (
            roomId !== ludoCurrentRoomId ||
            gameId !== ludoGameId
        ) {
            return;
        }

        await animateLudoTokenMove(
            color,
            tokenIndex,
            oldPosition,
            diceValue
        );

        if (data.captured > 0) {

            showLudoMessage(
                "🎯 Token captured! " +
                data.captured +
                " opponent token(s) returned home."
            );

        } else if (data.finished) {

            showLudoMessage(
                "🏆 " +
                String(data.winner || color).toUpperCase() +
                " wins the game!"
            );

        } else if (data.extra_turn) {

            showLudoMessage(
                "🎲 You rolled a 6! Play again."
            );

        } else {

            showLudoMessage("Token moved successfully.");
        }

    } catch (error) {

        console.error("Token movement error:", error);

        showLudoMessage(
            error.message || "Invalid token movement."
        );

    } finally {

        ludoAnimatingTokens = false;
        ludoBusy = false;

        updateLudoDiceHand();

        if (roomId === ludoCurrentRoomId) {
            await loadLudoGame();
        }
    }
};


// ==========================================
// PASS TURN
// ==========================================

async function passLudoTurn() {

    if (!ludoCurrentRoomId) return;

    if (
        ludoBusy ||
        ludoLoading ||
        ludoAnimatingTokens ||
        ludoDiceRolling
    ) {
        return;
    }

    const roomId = ludoCurrentRoomId;

    ludoBusy = true;

    updateLudoDiceHand();

    try {

        const { data, error } = await supabaseClient.rpc(
            "pass_ludo_turn",
            {
                p_room_id: roomId
            }
        );

        if (error) throw error;

        if (data && data.success === false) {
            throw new Error(
                data.message || "Turn could not be passed."
            );
        }

        clearLudoAutoPass();

        showLudoMessage(
            "No possible move. Turn passed."
        );

    } catch (error) {

        console.error("Pass turn error:", error);

        clearLudoAutoPass();

        showLudoMessage(
            error.message || "Unable to pass turn."
        );

    } finally {

        ludoBusy = false;

        updateLudoDiceHand();

        if (roomId === ludoCurrentRoomId) {
            await loadLudoGame();
        }
    }
}


// ==========================================
// UPDATE DISPLAY
// ==========================================

function updateLudoDisplay(game = null) {

    const turnElement = document.getElementById("currentTurn");
    const statusElement = document.getElementById("ludoStatus");
    const diceElement = document.getElementById("ludoDice");
    const startButton = document.getElementById("startLudoBtn");
    const joinButton = document.getElementById("joinLudoBtn");
    const leaveButton = document.getElementById("leaveLudoBtn");
    const leaveModal = document.getElementById("leaveLudoModal");

    const players = window.ludoPlayers || [];
    const myPlayer = getMyLudoPlayer();
    const hasLeft = Boolean(window.ludoHasLeftCurrentGame);

    if (!game) {

        if (turnElement) {
            turnElement.textContent = "Waiting for players";
        }

        if (statusElement) {
            statusElement.textContent = "Waiting for players";
        }

        if (diceElement) {
            diceElement.disabled = true;
            diceElement.classList.remove("is-current-turn");
        }

        if (startButton) {
            startButton.disabled = true;
        }

        if (joinButton) {
            joinButton.hidden = false;
            joinButton.disabled = false;
            joinButton.textContent = "Join Game";
        }

        if (leaveButton) {
            leaveButton.hidden = true;
        }

        if (leaveModal) {
            leaveModal.hidden = true;
        }

        resetLudoDice();
        stopLudoTurnTimer();

        const timer = document.getElementById("ludoTurnTimer");

        if (timer) {
            timer.hidden = true;
            timer.classList.remove("urgent");
        }

        renderLudoPlayers();
        updateLudoDiceHand();

        return;
    }

    let statusText = "Waiting for players";

    if (game.status === "playing") {
        statusText = "Game in progress";
    } else if (game.status === "finished") {
        statusText = "Game finished";
    }

  if (statusElement) {
    statusElement.textContent = hasLeft ? "SPECTATING" : statusText;
}

    const currentPlayer = getCurrentLudoPlayer(game);

    if (turnElement) {

        if (game.status === "playing" && currentPlayer) {

            const isMe =
                typeof currentUser !== "undefined" &&
                currentUser &&
                currentPlayer.user_id === currentUser.id;

            turnElement.textContent =
                currentPlayer.player_color.toUpperCase() +
                "'s Turn" +
                (isMe ? " (YOU)" : "");

        } else {

            turnElement.textContent = statusText;
        }
    }

    if (
        game.dice_value !== null &&
        game.dice_value !== undefined
    ) {
        showLudoDice(Number(game.dice_value));
    } else {
        resetLudoDice();
    }

    if (diceElement) {

        const isMyTurn =
            Boolean(myPlayer) &&
            typeof currentUser !== "undefined" &&
            currentUser &&
            game.current_turn_user_id === currentUser.id;

        const deadlineValid =
            !game.turn_deadline_at ||
            Date.parse(game.turn_deadline_at) > Date.now();

        diceElement.disabled =
            game.status !== "playing" ||
            !isMyTurn ||
            game.dice_value !== null ||
            ludoBusy ||
            ludoDiceRolling ||
            ludoAnimatingTokens ||
            !deadlineValid;
    }

    // JOIN / LEAVE BUTTON VISIBILITY

    if (joinButton) {

        const canJoin =
            !myPlayer &&
            !hasLeft &&
            game.status === "waiting" &&
            players.length < 4;

        joinButton.hidden = !canJoin;
        joinButton.disabled = !canJoin;
        joinButton.textContent = "Join Game";
    }

    if (leaveButton) {

        const canLeave =
            Boolean(myPlayer) &&
            (game.status === "waiting" || game.status === "playing");

        leaveButton.hidden = !canLeave;
        leaveButton.disabled = !canLeave;
    }

    // SPECTATOR: JOIN AND LEAVE BOTH HIDDEN

    if (hasLeft) {

        if (joinButton) {
            joinButton.hidden = true;
        }

        if (leaveButton) {
            leaveButton.hidden = true;
        }
    }

   if (startButton) {

    if (game.status !== "waiting") {
        startButton.style.setProperty("display", "none", "important");
        startButton.hidden = true;
    } else {
        startButton.style.removeProperty("display");
        startButton.hidden = false;

        const isFirstPlayer =
            myPlayer &&
            myPlayer.seat_number === 1;

        startButton.disabled =
            players.length < 2 ||
            !isFirstPlayer;
    }
}

    renderLudoPlayers();
    updateLudoTurnTimer();
    updateLudoDiceHand();
}


// ==========================================
// REALTIME MOVE EVENT HANDLER
// ==========================================

function handleLudoMoveEvent(payload) {

    const move = payload && payload.new;

    if (!move || !move.id) return;

    if (ludoSeenMoveIds.has(move.id)) return;

    ludoSeenMoveIds.add(move.id);

    if (ludoSeenMoveIds.size > 250) {
        const first = ludoSeenMoveIds.values().next().value;
        ludoSeenMoveIds.delete(first);
    }

    const moveType = move.move_type;
    const moveData = move.move_data || {};

    if (moveType === "token_move") {

        if (moveData.token_finished === true) {

            const color =
                moveData.color ||
                moveData.player_color;

            if (color && LUDO_COLORS.includes(color)) {

                showLudoFinishCelebration(color);

                showLudoMessage(
                    "🎉 " + color.toUpperCase() +
                    " token reached home!"
                );
            }
        }

        const capturedCount = Array.isArray(moveData.captured_players)
            ? moveData.captured_players.length
            : Number(moveData.captured || 0);

        if (capturedCount > 0) {

            playLudoCaptureSound();

            showLudoMessage(
                "🐍 Token captured!"
            );
        }
    }

    // game_finish is intentionally ignored.
    // Token finish event handles the celebration.
}


// ==========================================
// REALTIME SUBSCRIPTIONS
// ==========================================

function subscribeLudoRealtime(gameId) {

    if (!gameId) return;

    const expectedTopic = "realtime:ludo-game-" + gameId;

    if (
        ludoGameChannel &&
        ludoGameChannel.topic === expectedTopic
    ) {
        return;
    }

    removeLudoRealtime();

    ludoGameChannel = supabaseClient
        .channel("ludo-game-" + gameId)
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "ludo_games",
                filter: "id=eq." + gameId
            },
            () => {
                loadLudoGame();
            }
        )
        .subscribe();

    ludoPlayersChannel = supabaseClient
        .channel("ludo-players-" + gameId)
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "ludo_players",
                filter: "game_id=eq." + gameId
            },
            () => {
                loadLudoGame();
            }
        )
        .subscribe();

    ludoMovesChannel = supabaseClient
        .channel("ludo-moves-" + gameId)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "ludo_moves",
                filter: "game_id=eq." + gameId
            },
            payload => {

                handleLudoMoveEvent(payload);

                loadLudoGame();
            }
        )
        .subscribe();
}


// ==========================================
// REMOVE REALTIME
// ==========================================

function removeLudoRealtime() {

    if (ludoGameChannel) {
        supabaseClient.removeChannel(ludoGameChannel);
        ludoGameChannel = null;
    }

    if (ludoPlayersChannel) {
        supabaseClient.removeChannel(ludoPlayersChannel);
        ludoPlayersChannel = null;
    }

    if (ludoMovesChannel) {
        supabaseClient.removeChannel(ludoMovesChannel);
        ludoMovesChannel = null;
    }
}


// ==========================================
// MESSAGE
// ==========================================

function showLudoMessage(message) {

    const element = document.getElementById("ludoMessage");

    if (element) {
        element.textContent = String(message || "");
    }
}


// ==========================================
// DESTROY LUDO
// ==========================================

window.destroyLudo = async function() {

    ludoRoomVersion++;
    ludoLoadVersion++;
    ludoMoveAnimationId++;

    removeLudoRealtime();

    clearLudoAutoPass();
    stopLudoTurnTimer();

    ludoTimeoutInFlight = false;
    ludoTimeoutKey = null;

    ludoSeenMoveIds.clear();

    const cube = document.getElementById("diceCube");

    if (cube && cube._ludoAnimation) {
        cube._ludoAnimation.cancel();
        cube._ludoAnimation = null;
    }

    const diceButton = document.getElementById("ludoDice");

    if (diceButton) {
        diceButton.classList.remove("is-current-turn");
    }

    ludoGameId = null;
    ludoCurrentRoomId = null;

    window.ludoPlayers = [];
    window.ludoGameData = null;

    ludoLoading = false;
    ludoBusy = false;
    ludoLoaded = false;

    ludoAnimatingTokens = false;
    ludoDiceRolling = false;
    ludoPendingDiceValue = null;

    const section = document.getElementById("ludoSection");
    const button = document.getElementById("openLudoBtn");

    if (section) {
        section.hidden = true;
    }

    if (button) {
        button.textContent = "🎲 Play Ludo";
        button.setAttribute("aria-expanded", "false");
    }
};


// ==========================================
// OPEN BUTTON
// ==========================================

document.addEventListener("DOMContentLoaded", function() {

    const openBtn = document.getElementById("openLudoBtn");

    if (openBtn) {
        openBtn.onclick = openLudoPage;
    }
});


// ==========================================
// END
// ==========================================
