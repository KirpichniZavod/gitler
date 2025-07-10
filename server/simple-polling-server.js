const express = require("express")
const cors = require("cors")
const path = require("path")
const fs = require("fs")

console.log("🚀 ПРОСТОЙ POLLING СЕРВЕР")

const app = express()
const PORT = process.env.PORT || 3000

// Хранилище в памяти (вместо WebSocket)
const users = new Map()
const rooms = new Map()
const messages = new Map() // roomId -> messages[]

app.use(cors())
app.use(express.json())

// Главная страница - возвращаем игру
app.get("/", (req, res) => {
  try {
    const htmlPath = path.join(__dirname, "..", "app", "src", "main", "assets", "polling-game.html")
    if (fs.existsSync(htmlPath)) {
      const html = fs.readFileSync(htmlPath, "utf8")
      res.setHeader("Content-Type", "text/html; charset=utf-8")
      res.send(html)
    } else {
      res.json({
        status: "OK",
        message: "Polling сервер работает!",
        endpoints: ["/api/login", "/api/rooms", "/api/poll"],
      })
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// API для авторизации
app.post("/api/login", (req, res) => {
  const { nickname, password } = req.body

  if (!nickname || !password) {
    return res.status(400).json({ error: "Никнейм и пароль обязательны" })
  }

  const userId = Date.now().toString()
  const user = {
    id: userId,
    nickname,
    avatar: "👤",
    coins: 100,
    currentRoom: null,
  }

  users.set(userId, user)

  res.json({
    success: true,
    user: user,
    token: userId,
  })
})

// API для получения комнат
app.get("/api/rooms", (req, res) => {
  const roomsList = Array.from(rooms.values()).map((room) => ({
    id: room.id,
    name: room.name,
    players: room.players.length,
    maxPlayers: room.maxPlayers,
    status: room.status,
  }))

  res.json({ rooms: roomsList })
})

// API для создания комнаты
app.post("/api/create-room", (req, res) => {
  const { name, maxPlayers = 10 } = req.body
  const token = req.headers.authorization

  const user = users.get(token)
  if (!user) {
    return res.status(401).json({ error: "Не авторизован" })
  }

  const roomId = Date.now().toString()
  const room = {
    id: roomId,
    name,
    maxPlayers,
    status: "waiting",
    players: [user],
    creator: user.nickname,
  }

  rooms.set(roomId, room)
  messages.set(roomId, [])
  user.currentRoom = roomId

  res.json({ success: true, room })
})

// API для присоединения к комнате
app.post("/api/join-room", (req, res) => {
  const { roomId } = req.body
  const token = req.headers.authorization

  const user = users.get(token)
  const room = rooms.get(roomId)

  if (!user) {
    return res.status(401).json({ error: "Не авторизован" })
  }

  if (!room) {
    return res.status(404).json({ error: "Комната не найдена" })
  }

  if (room.players.length >= room.maxPlayers) {
    return res.status(400).json({ error: "Комната заполнена" })
  }

  room.players.push(user)
  user.currentRoom = roomId

  res.json({ success: true, room })
})

// API для отправки сообщения
app.post("/api/send-message", (req, res) => {
  const { message } = req.body
  const token = req.headers.authorization

  const user = users.get(token)
  if (!user || !user.currentRoom) {
    return res.status(401).json({ error: "Не в комнате" })
  }

  const roomMessages = messages.get(user.currentRoom) || []
  roomMessages.push({
    sender: user.nickname,
    message,
    timestamp: new Date().toISOString(),
  })

  // Оставляем только последние 50 сообщений
  if (roomMessages.length > 50) {
    roomMessages.splice(0, roomMessages.length - 50)
  }

  messages.set(user.currentRoom, roomMessages)

  res.json({ success: true })
})

// API для polling - получение обновлений
app.get("/api/poll", (req, res) => {
  const token = req.headers.authorization
  const user = users.get(token)

  if (!user) {
    return res.status(401).json({ error: "Не авторизован" })
  }

  const response = {
    user: user,
    rooms: Array.from(rooms.values()),
    currentRoom: user.currentRoom ? rooms.get(user.currentRoom) : null,
    messages: user.currentRoom ? messages.get(user.currentRoom) || [] : [],
  }

  res.json(response)
})

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    users: users.size,
    rooms: rooms.size,
  })
})

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🎉 Polling сервер запущен на порту ${PORT}`)
  console.log(`🌐 HTTP: http://localhost:${PORT}`)
})
