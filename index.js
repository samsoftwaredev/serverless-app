const fs = require("fs");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const localhostRegex = /http:\/\/localhost/;
const io = new Server(server, {
  cors: { origin: localhostRegex },
});

const product = require("./api/product");
const index = require("./api/index");

app.use(express.json({ extended: false }));

app.use("/api/product", product);
app.use("/health", index);
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

const PORT = process.env.PORT || 8080;
const DATA_FILE = __dirname + "/order-data.json";

// Initialize order data.
const orders = JSON.parse(fs.readFileSync(DATA_FILE));
const byTime = {};
orders.forEach((order) => {
  const timestamp = String(order.sent_at_second);
  if (byTime[timestamp]) {
    byTime[timestamp].push(order);
  } else {
    byTime[timestamp] = [order];
  }
});

/**
 * This server is a very naive implementation of a order service.
 *
 * It waits for a new connection, upon which it iterates through a
 * JSON file of sample order data and sends it down to the connected
 * client. The server will restart the order events for a new connection,
 * and stops after it receives a disconnect. Feel free to extend this if needed,
 * it's meant to be quite bare-bones :)
 */
io.on("connection", (socket) => {
  console.log("New connection");
  let elapsed = 0;
  const ticker = setInterval(() => {
    if (elapsed >= 330) {
      console.log("All order events sent");
      clearInterval(ticker);
      return;
    }
    const toSend = byTime[String(elapsed)];
    if (toSend && toSend.length > 0) {
      io.emit("order_event", toSend);
    }
    elapsed += 1;
  }, 1000);

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    clearInterval(ticker);
  });
});

server.listen(PORT, () => console.log(`Server is running in port ${PORT}`));
