// Łączymy się z lokalnym serwerem podczas programowania
const socket = window.socket;

const statusUI = document.getElementById("status");

socket.on("connect", () => {
    statusUI.innerText = "Połączono z Nawią";
    statusUI.style.color = "#4caf50";
});

socket.on("disconnect", () => {
    statusUI.innerText = "Utracono połączenie!";
    statusUI.style.color = "#f44336";
});

// Funkcja wywoływana przez GPS (engine.js)
function sendLocationToServer(lat, lng) {
    if (socket.connected) {
        socket.emit("player_moved", { lat, lng });
    }
}