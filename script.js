console.log("Js file has loaded");

const chatLog = document.getElementById("chat-log");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-button");
const conversationSelect = document.getElementById("conversation-select");
const newConversationBtn = document.getElementById("new-conversation-btn");
const exportBtn = document.getElementById("export-chat-btn");
let abortController = null;
const API_KEY = "AQ.Ab8RN6IgZ6mznb4dqaJvB-xzyPaQgRipstn-8jEi-urMx0EvYQ";

function showErrorMessage(text) {
    addMessage("bot", `⚠️ ${text}`, new Date().toISOString());
}



function addMessage(sender, text, timestamp = null, save = true) {
    const message = document.createElement("div");
    message.classList.add("message", sender);

    const content = document.createElement("div");

    // Add the space right inside the label string after the colon
    const labelSpan = document.createElement("span");
    labelSpan.innerHTML = `<strong>${sender === "user" ? "You: " : "Droid: "}</strong>`;

    const textSpan = document.createElement("span");
    textSpan.innerHTML = formatMessage(text);

    content.appendChild(labelSpan);
    content.appendChild(textSpan);

    message.appendChild(content);

    const ts = timestamp ? new Date(timestamp) : new Date();
    const timestampDiv = document.createElement("div");
    timestampDiv.classList.add("timestamp");
    timestampDiv.textContent = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    message.appendChild(timestampDiv);

    chatLog.appendChild(message);
    chatLog.scrollTo({
        top: chatLog.scrollHeight,
        behavior: "smooth"
    });

    if (save) {
        saveMessageToStorage(sender, text, ts.toISOString());
    }
}


function formatMessage(text) {
    if (!text) return "";

    text = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");

    text = text.replace(/`(.*?)`/g, "<code>$1</code>");

    text = text.replace(/\n/g, "<br>");

    text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

    return text;
}

function typeMessage(text, sender) {
    text = text.trimStart().replace(/^:+/, '').trimStart();

    let typeInterval, blinkInterval;
    let cancelled = false;

    const promise = new Promise((resolve) => {
        const message = document.createElement("div");
        message.classList.add("message", sender);
        chatLog.appendChild(message);
        chatLog.scrollTo({
            top: chatLog.scrollHeight,
            behavior: "smooth"
        });

        const formattedHTML = formatMessage(text);
        let index = 0;
        let cursorVisible = true;

        const cursor = document.createElement("span");
        cursor.textContent = "|";
        cursor.style.color = "#fff";
        cursor.style.fontWeight = "bold";
        cursor.style.marginLeft = "4px";

        message.innerHTML = `<strong>${sender === "user" ? "You" : "Droid"}:</strong> `;
        message.appendChild(cursor);

        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = formattedHTML;
        const fullText = tempDiv.innerHTML;

        blinkInterval = setInterval(() => {
            cursor.style.visibility = cursorVisible ? "hidden" : "visible";
            cursorVisible = !cursorVisible;
        }, 500);

        typeInterval = setInterval(() => {
            if (cancelled) {
                clearInterval(typeInterval);
                clearInterval(blinkInterval);
                cursor.style.visibility = "hidden";
                // Keep the current partial message content intact here
                // Optionally, add a timestamp or a note "Stopped" if you want
                resolve('cancelled');
                return;
            }
            if(index < fullText.length) {
                // Append only the next character instead of resetting innerHTML completely:
                // But since innerHTML is HTML, better to do substring approach:
                message.innerHTML = `<strong>${sender === "user" ? "You" : "Droid"}:</strong> ` + fullText.substring(0, index + 1);
                message.appendChild(cursor);
                index++;
                chatLog.scrollTo({
                    top: chatLog.scrollHeight,
                    behavior: "smooth"
                });
            } else {
                clearInterval(typeInterval);
                clearInterval(blinkInterval);
                cursor.style.visibility = "hidden";

                const timestamp = document.createElement("div");
                timestamp.classList.add("timestamp");
                timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'});
                message.appendChild(timestamp);

                saveMessageToStorage(sender, text, new Date().toISOString());

                resolve();
            }
        }, 10);
    });

    return {
        promise,
        cancel() {
            cancelled = true;
        }
    };
}

async function fetchGeminiReply(promptText, signal) {
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    
    const requestBody = {
        contents: [
            {
                role: "user",
                parts: [{ text: promptText }]
            }
        ]
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody),
            signal,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            console.error("Gemini API error:", errorData);

            const code = errorData?.error?.code || response.status;
            const message = errorData?.error?.message;

            if (code === 401) {
                showErrorMessage("API key invalid or not authorized.");
            } else if (code === 403) {
                showErrorMessage("Access denied. Key may be restricted.");
            } else if (code === 404) {
                showErrorMessage("Model not found. Check model name.");
            } else if (code === 503) {
                showErrorMessage("Model overloaded. Try again.");
            }

            return null;
        }

        const data = await response.json();
        console.log("Gemini raw response:", data);

        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return reply || "Hmm... I'm speechless.";
    } catch (err) {
        if(err.name === 'AbortError') {
            console.log("Fetch aborted");
            throw err;
        }
        console.error("Fetch failed:", err);
        showErrorMessage("I'm having a glitch! Try again later.");
        return null; 
    }
}

async function fetchJoke(){
    try{
        const response = await fetch("https://official-joke-api.appspot.com/random_joke");
        if(!response.ok) throw new Error("Failed to fetch joke");

        const data = await response.json();
        return `${data.setup} ... ${data.punchline}`;
    }catch(err) {
        console.error("Joke fetch error:", err);
        showErrorMessage("Oops! I couldn't find a joke right now.");
        return null;
    }
}

function showThinkingAnimation() {
    const thinkingMsg = document.createElement("div");
    thinkingMsg.classList.add("message", "bot");

    const thinkingText = document.createElement("span");
    thinkingText.textContent = "Droid is thinking";
    thinkingMsg.appendChild(thinkingText);

    const dotsContainer = document.createElement("span");
    dotsContainer.style.marginLeft = "6px";

    const dots = [];
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement("span");
        dot.textContent = ".";
        dot.style.opacity = "0.3";
        dot.style.fontWeight = "bold";
        dot.style.fontSize = "20px";
        dot.style.color = "white";
        dot.style.transition = "opacity 0.3s ease-in-out";
        dotsContainer.appendChild(dot);
        dots.push(dot);
    }

    thinkingMsg.appendChild(dotsContainer);
    chatLog.appendChild(thinkingMsg);
    chatLog.scrollTop = chatLog.scrollHeight;

    let currentDot = 0;
    const interval = setInterval(() => {
        dots.forEach(dot => dot.style.opacity = "0.3");
        dots[currentDot].style.opacity = "1";
        currentDot = (currentDot + 1) % dots.length;
    }, 400);

    return { thinkingMsg, interval };
}

const stopBtn = document.getElementById("stop-button");

let currentTyping = null;

sendBtn.addEventListener("click", async () => {
    const userText = userInput.value.trim();
    if (!userText || userText.length > 200) return;

    addMessage("user", userText);
    userInput.value = "";
    userInput.focus();

    sendBtn.disabled = true;
    stopBtn.disabled = false;

    abortController = new AbortController();

    const { thinkingMsg, interval } = showThinkingAnimation();

    let geminiReply = null;

    try {
        if (userText.toLowerCase().includes("tell me a joke")) {
            geminiReply = await fetchJoke();
        } else {
            geminiReply = await fetchGeminiReply(userText, abortController.signal);
}
    } catch (err) {
        if(err.name === 'AbortError') {
            showErrorMessage("Response generation stopped by user.")
        } else {
            showErrorMessage("Oops, something went wrong!")
        }
    } finally {
        clearInterval(interval)
        thinkingMsg.remove();
        abortController = null;
    }
    
    
    if(geminiReply !== null) {
        currentTyping = typeMessage(geminiReply, "bot")
        await currentTyping.promise;
        currentTyping = null;
    }

    sendBtn.disabled = false;
    stopBtn.disabled = true;
});

stopBtn.addEventListener("click", () => {
    if(abortController) {
        abortController.abort()
    }
    if (currentTyping) {
        currentTyping.cancel();
        currentTyping = null;
    }
});

userInput.addEventListener("keydown", async (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();  
        sendBtn.click();         
    }
});

const clearBtn = document.getElementById("clear-button");
clearBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear the chat? This cannot be undone.")) {
        chatLog.innerHTML = "";

        const saved = JSON.parse(localStorage.getItem("droidchat_conversations") || "{}");
        saved[currentConversation] = [];
        localStorage.setItem("droidchat_conversations", JSON.stringify(saved));
    }
});

let currentConversation = "default";

// Load all conversations into dropdown
function loadConversations() {
    const saved = JSON.parse(localStorage.getItem("droidchat_conversations") || "{}");
    conversationSelect.innerHTML = "";

    Object.keys(saved).forEach(conv => {
        const option = document.createElement("option");
        option.value = conv;
        option.textContent = conv;
        conversationSelect.appendChild(option);
    });

    // Set the select to currentConversation if it exists
    if(saved[currentConversation]){
        conversationSelect.value = currentConversation;
    } else {
        // If currentConversation doesn't exist, select the first one
        const firstKey = Object.keys(saved)[0];
        currentConversation = firstKey || "default";
        conversationSelect.value = currentConversation;
    }

    loadMessages();
}

// Load messages for the current conversation
function loadMessages() {
    chatLog.innerHTML = "";
    const saved = JSON.parse(localStorage.getItem("droidchat_conversations") || "{}");
    const messages = saved[currentConversation] || [];
    messages.forEach(msg => addMessage(msg.sender, msg.text, msg.timestamp, false));
}

// Save a message to the current conversation
function saveMessageToStorage(sender, text, timestamp) {
    const saved = JSON.parse(localStorage.getItem("droidchat_conversations") || "{}");
    if (!saved[currentConversation]) saved[currentConversation] = [];
    saved[currentConversation].push({ sender, text, timestamp });
    localStorage.setItem("droidchat_conversations", JSON.stringify(saved));
}

// Switch conversation
conversationSelect.addEventListener("change", () => {
    currentConversation = conversationSelect.value;
    loadMessages();
});

// Create new conversation
newConversationBtn.addEventListener("click", () => {
    const name = prompt("Enter a name for the new conversation:");
    if (!name) return;
    currentConversation = name;

    const saved = JSON.parse(localStorage.getItem("droidchat_conversations") || "{}");
    if (!saved[name]) saved[name] = [];
    localStorage.setItem("droidchat_conversations", JSON.stringify(saved));

    loadConversations();
});

// Export current conversation
exportBtn.addEventListener("click", () => {
    const saved = JSON.parse(localStorage.getItem("droidchat_conversations") || "{}");
    const messages = saved[currentConversation] || [];
    if (messages.length === 0) {
        alert("Nothing to export!");
        return;
    }

    const blob = new Blob([JSON.stringify(messages, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DroidChat-${currentConversation}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Initial load
loadConversations();

const deleteConversationBtn = document.getElementById("delete-conversation-btn");

deleteConversationBtn.addEventListener("click", () => {
    const saved = JSON.parse(localStorage.getItem("droidchat_conversations") || "{}");
    if(!saved[currentConversation]) return;

    if(confirm(`Are you sure you want to delete conversation "${currentConversation}"? This cannot be undone.`)) {
        delete saved[currentConversation];
        localStorage.setItem("droidchat_conversations", JSON.stringify(saved));

        // Switch to first available conversation or default
        const remaining = Object.keys(saved);
        currentConversation = remaining[0] || "default";
        if(!saved[currentConversation]) saved[currentConversation] = [];
        localStorage.setItem("droidchat_conversations", JSON.stringify(saved));

        loadConversations();
    }
});