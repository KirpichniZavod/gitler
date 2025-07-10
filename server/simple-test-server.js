console.log("🚀 Starting simple test server...")

const express = require("express")
const app = express()

// Получаем порт из переменной окружения или используем 3000
const PORT = process.env.PORT || 3000

console.log(`📡 Port from environment: ${process.env.PORT}`)
console.log(`🎯 Using port: ${PORT}`)

// Middleware для логирования всех запросов
app.use((req, res, next) => {
  console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.url}`)
  console.log(`📍 Headers:`, req.headers)
  next()
})

// Основные маршруты
app.get("/", (req, res) => {
  console.log("🏠 Home page requested")
  res.json({
    status: "OK",
    message: "Simple test server is working!",
    timestamp: new Date().toISOString(),
    port: PORT,
  })
})

app.get("/health", (req, res) => {
  console.log("❤️ Health check requested")
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  })
})

app.get("/test", (req, res) => {
  console.log("🧪 Test endpoint requested")
  res.json({
    message: "Test successful!",
    env: process.env.NODE_ENV,
    port: PORT,
  })
})

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error("❌ Error:", err)
  res.status(500).json({ error: "Internal server error" })
})

// Запуск сервера
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log("🎉 Simple test server started successfully!")
  console.log(`🌐 Server running on http://0.0.0.0:${PORT}`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`)
  console.log(`⏰ Started at: ${new Date().toISOString()}`)
})

// Обработка сигналов завершения
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully")
  server.close(() => {
    console.log("✅ Server closed")
    process.exit(0)
  })
})

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down gracefully")
  server.close(() => {
    console.log("✅ Server closed")
    process.exit(0)
  })
})

// Обработка необработанных ошибок
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err)
  process.exit(1)
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection at:", promise, "reason:", reason)
  process.exit(1)
})

console.log("✅ Simple test server setup complete!")
