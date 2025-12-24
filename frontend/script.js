const socket = io();

// send message
function sendMessage() {
  const input = document.getElementById("messageInput");
  if (input.value === "") return;

  socket.emit("send-message", input.value);
  input.value = "";
}

// receive message
socket.on("receive-message", (msg) => {
  const messagesDiv = document.getElementById("messages");
  const p = document.createElement("p");
  p.textContent = msg;
  messagesDiv.appendChild(p);
});
