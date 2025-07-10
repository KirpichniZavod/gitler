const express = require("express")
const http = require("http")
const WebSocket = require("ws")
const cors = require("cors")
const path = require("path")
const fs = require("fs")

console.log("🚀 СТАРТ ПРИЛОЖЕНИЯ - НАЧАЛО ЗАГРУЗКИ МОДУЛЕЙ")
console.log(`📅 Время: ${new Date().toISOString()}`)
console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV}`)
console.log(`🔌 PORT: ${process.env.PORT}`)

let Database, WebSocketHandler, GameEngine

try {
  console.log("📦 Загрузка Database...")
  Database = require("./database")
  console.log("✅ Database загружен")
} catch (error) {
  console.error("❌ ОШИБКА загрузки Database:", error)
  process.exit(1)
}

try {
  console.log("📦 Загрузка WebSocketHandler...")
  WebSocketHandler = require("./websocket-handler")
  console.log("✅ WebSocketHandler загружен")
} catch (error) {
  console.error("❌ ОШИБКА загрузки WebSocketHandler:", error)
  process.exit(1)
}

try {
  console.log("📦 Загрузка GameEngine...")
  GameEngine = require("./game-engine")
  console.log("✅ GameEngine загружен")
} catch (error) {
  console.error("❌ ОШИБКА загрузки GameEngine:", error)
  process.exit(1)
}

console.log("✅ ВСЕ МОДУЛИ ЗАГРУЖЕНЫ")

class MafiaGameServer {
  constructor() {
    console.log("🏗️ СОЗДАНИЕ ЭКЗЕМПЛЯРА MafiaGameServer...")

    this.port = process.env.PORT || 3000
    console.log(`🔌 Порт установлен: ${this.port}`)

    try {
      console.log("🌐 Создание Express приложения...")
      this.app = express()
      console.log("✅ Express создан")

      console.log("🌐 Создание HTTP сервера...")
      this.server = http.createServer(this.app)
      console.log("✅ HTTP сервер создан")

      console.log("🔌 Создание WebSocket сервера...")
      this.wss = new WebSocket.Server({
        server: this.server,
        path: "/ws",
        perMessageDeflate: false,
        clientTracking: true,
        maxPayload: 100 * 1024 * 1024,
        verifyClient: (info) => {
          const ip = info.req.socket.remoteAddress
          const origin = info.req.headers.origin
          console.log(`🔍 WebSocket verifyClient от ${ip}, origin: ${origin}`)
          console.log(`🔍 Headers:`, JSON.stringify(info.req.headers, null, 2))
          return true
        },
      })
      console.log("✅ WebSocket сервер создан")

      // Логирование событий WebSocket сервера
      this.wss.on("listening", () => {
        console.log("🎉 WebSocket сервер начал слушать!")
      })

      this.wss.on("error", (error) => {
        console.error("❌ ОШИБКА WebSocket СЕРВЕРА:", error)
      })

      this.wss.on("headers", (headers, request) => {
        console.log("📋 WebSocket headers:", headers)
      })

      console.log("💾 Создание Database...")
      this.db = new Database()
      console.log("✅ Database создан")

      console.log("🎮 Создание GameEngine...")
      this.gameEngine = new GameEngine()
      console.log("✅ GameEngine создан")

      console.log("🔌 Создание WebSocketHandler...")
      this.wsHandler = new WebSocketHandler(this.wss, this.db, this.gameEngine)
      console.log("✅ WebSocketHandler создан")

      this.gameEngine.setRooms(this.wsHandler.rooms)
      this.gameEngine.setDatabase(this.db)

      this.setupMiddleware()
      this.setupRoutes()
      this.setupErrorHandling()

      console.log("✅ MafiaGameServer создан успешно")
    } catch (error) {
      console.error("❌ КРИТИЧЕСКАЯ ОШИБКА создания MafiaGameServer:", error)
      process.exit(1)
    }
  }

  setupMiddleware() {
    console.log("🔧 Настройка middleware...")

    this.app.use(
      cors({
        origin: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
        credentials: true,
      }),
    )

    this.app.use(express.json({ limit: "10mb" }))
    this.app.use(express.urlencoded({ extended: true }))

    // Логирование всех запросов
    this.app.use((req, res, next) => {
      const startTime = Date.now()
      console.log(`📥 ${req.method} ${req.url} от ${req.ip}`)
      console.log(`📋 Headers:`, JSON.stringify(req.headers, null, 2))

      res.on("finish", () => {
        const duration = Date.now() - startTime
        console.log(`📤 ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`)
      })

      next()
    })

    console.log("✅ Middleware настроен")
  }

  setupRoutes() {
    console.log("🛣️ Настройка маршрутов...")

    // ГЛАВНАЯ СТРАНИЦА - ВОЗВРАЩАЕМ ИГРУ
    this.app.get("/", async (req, res) => {
      console.log("🏠 ЗАПРОС ГЛАВНОЙ СТРАНИЦЫ!")

      try {
        // Исправляем путь к HTML файлу
        const htmlPath = path.join(__dirname, "..", "app", "src", "main", "assets", "index.html")
        console.log(`📁 Путь к HTML: ${htmlPath}`)
        console.log(`📁 Файл существует: ${fs.existsSync(htmlPath)}`)

        if (fs.existsSync(htmlPath)) {
          const html = fs.readFileSync(htmlPath, "utf8")
          console.log("✅ HTML файл найден и прочитан")
          console.log(`📏 Размер файла: ${html.length} символов`)

          // Заменяем WebSocket URL на правильный для продакшена
          const wsUrl = `wss://${req.get("host")}/ws`
          console.log(`🔗 WebSocket URL: ${wsUrl}`)

          const modifiedHtml = html.replace(/const WS_URL = '[^']*'/g, `const WS_URL = '${wsUrl}'`)

          res.setHeader("Content-Type", "text/html; charset=utf-8")
          res.send(modifiedHtml)
          console.log("✅ HTML отправлен клиенту")
        } else {
          console.log("❌ HTML файл не найден, отправляем статус")

          // Если файла нет, отправляем статус сервера
          const dbStats = await this.db.getStats()
          const response = {
            server: "🎭 Mafia Game Server",
            status: "running",
            message: "HTML файл игры не найден",
            htmlPath: htmlPath,
            timestamp: new Date().toISOString(),
            uptime: Math.floor(process.uptime()),
            websocket: {
              url: `wss://${req.get("host")}/ws`,
              clients: this.wss.clients.size,
              ready: true,
            },
            game: {
              totalUsers: dbStats.totalUsers,
              onlineUsers: this.wsHandler.users.size,
              activeRooms: this.wsHandler.rooms.size,
            },
          }

          res.json(response)
        }
      } catch (error) {
        console.error("❌ Ошибка обработки главной страницы:", error)
        res.status(500).json({
          error: "Ошибка сервера",
          message: error.message,
          timestamp: new Date().toISOString(),
        })
      }
    })

    // Health check для Render
    this.app.get("/health", (req, res) => {
      console.log("❤️ Health check")
      res.json({
        status: "healthy",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        websocket: {
          clients: this.wss.clients.size,
          ready: true,
        },
      })
    })

    // API статус
    this.app.get("/api/status", async (req, res) => {
      console.log("📊 API статус запрос")

      try {
        const dbStats = await this.db.getStats()
        const response = {
          server: "🎭 Mafia Game Server",
          status: "running",
          timestamp: new Date().toISOString(),
          uptime: Math.floor(process.uptime()),
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          },
          websocket: {
            url: `wss://${req.get("host")}/ws`,
            clients: this.wss.clients.size,
            ready: true,
          },
          game: {
            totalUsers: dbStats.totalUsers,
            totalGames: dbStats.totalGames,
            onlineUsers: this.wsHandler.users.size,
            authenticatedUsers: Array.from(this.wsHandler.users.values()).filter((u) => u.isAuthenticated).length,
            activeRooms: this.wsHandler.rooms.size,
            activeGames: this.gameEngine.getGameStats().activeGames,
          },
        }

        res.json(response)
      } catch (error) {
        console.error("❌ Ошибка получения статуса:", error)
        res.status(500).json({
          error: "Ошибка получения статуса сервера",
          message: error.message,
          timestamp: new Date().toISOString(),
        })
      }
    })

    // Простой тест
    this.app.get("/test", (req, res) => {
      console.log("🧪 Тест запрос")
      res.json({
        test: "OK",
        message: "Сервер работает!",
        websocket_url: `wss://${req.get("host")}/ws`,
        timestamp: new Date().toISOString(),
      })
    })

    // WebSocket тест
    this.app.get("/ws-test", (req, res) => {
      console.log("🔌 WebSocket тест")
      res.json({
        websocket: "available",
        url: `wss://${req.get("host")}/ws`,
        clients: this.wss.clients.size,
        ready: true,
        timestamp: new Date().toISOString(),
      })
    })

    // Тестовая страница WebSocket
    this.app.get("/test-ws", (req, res) => {
      console.log("🧪 Тестовая страница WebSocket")
      try {
        const htmlPath = path.join(__dirname, "test-websocket.html")
        let html = fs.readFileSync(htmlPath, "utf8")

        // Заменяем URL на правильный
        html = html.replace(/const wsUrl = `[^`]*`/, `const wsUrl = \`wss://${req.get("host")}/ws\``)

        res.setHeader("Content-Type", "text/html")
        res.send(html)
      } catch (error) {
        console.error("❌ Ошибка загрузки тестовой страницы:", error)
        res.status(500).send("Ошибка загрузки тестовой страницы")
      }
    })

    console.log("✅ Маршруты настроены")
  }

  setupErrorHandling() {
    console.log("🚨 Настройка обработки ошибок...")

    // 404 обработчик
    this.app.use((req, res) => {
      console.log(`❌ 404 - Маршрут не найден: ${req.method} ${req.path}`)
      res.status(404).json({
        error: "Маршрут не найден",
        path: req.path,
        method: req.method,
        available_endpoints: ["/", "/health", "/api/status", "/test", "/ws-test", "/test-ws"],
        websocket_url: `wss://${req.get("host")}/ws`,
        timestamp: new Date().toISOString(),
      })
    })

    // Глобальный обработчик ошибок
    this.app.use((error, req, res, next) => {
      console.error("❌ ГЛОБАЛЬНАЯ ОШИБКА:", error)
      res.status(500).json({
        error: "Внутренняя ошибка сервера",
        message: error.message,
        timestamp: new Date().toISOString(),
      })
    })

    console.log("✅ Обработка ошибок настроена")
  }

  async start() {
    try {
      console.log("🚀🚀🚀 ЗАПУСК MAFIA GAME SERVER 🚀🚀🚀")
      console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV}`)
      console.log(`🔌 PORT: ${this.port}`)

      // Инициализируем базу данных
      console.log("💾 Инициализация базы данных...")
      await this.db.init()
      console.log("✅ База данных инициализирована")

      // Настраиваем обработчики событий сервера
      this.server.on("listening", () => {
        console.log("🎉🎉🎉 HTTP СЕРВЕР ЗАПУЩЕН! 🎉🎉🎉")
        console.log(`🚀 Mafia Game Server работает на порту ${this.port}`)
        console.log(`🌐 HTTP: http://localhost:${this.port}`)
        console.log(`🔌 WebSocket: ws://localhost:${this.port}/ws`)
        console.log(`🔌 WebSocket (WSS): wss://localhost:${this.port}/ws`)
      })

      this.server.on("error", (error) => {
        console.error("❌ ОШИБКА HTTP СЕРВЕРА:", error)
        if (error.code === "EADDRINUSE") {
          console.error(`❌ Порт ${this.port} уже используется!`)
        }
        process.exit(1)
      })

      this.server.on("upgrade", (request, socket, head) => {
        console.log("🔄 HTTP UPGRADE запрос для WebSocket")
        console.log(`🔗 URL: ${request.url}`)
        console.log(`📋 Headers:`, JSON.stringify(request.headers, null, 2))
      })

      // Запускаем сервер
      this.server.listen(this.port, "0.0.0.0", () => {
        console.log(`✅ Сервер запущен на 0.0.0.0:${this.port}`)
        console.log(`🔌 WebSocket доступен по пути /ws`)
      })

      // Обработка сигналов завершения
      process.on("SIGTERM", () => this.shutdown())
      process.on("SIGINT", () => this.shutdown())

      // Логируем статистику каждые 30 секунд
      setInterval(() => {
        console.log(
          `📊 Время работы: ${Math.floor(process.uptime())}с, Память: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB, WebSocket клиентов: ${this.wss.clients.size}`,
        )
      }, 30000)
    } catch (error) {
      console.error("❌ КРИТИЧЕСКАЯ ОШИБКА запуска сервера:", error)
      process.exit(1)
    }
  }

  async shutdown() {
    console.log("🛑 Завершение работы сервера...")
    try {
      this.wss.clients.forEach((client) => client.close())
      this.server.close()
      await this.db.close()
      console.log("✅ Сервер завершил работу")
      process.exit(0)
    } catch (error) {
      console.error("❌ Ошибка при завершении:", error)
      process.exit(1)
    }
  }
}

// ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ ОШИБОК
process.on("uncaughtException", (error) => {
  console.error("❌ UNCAUGHT EXCEPTION:", error)
  console.error("Stack:", error.stack)
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ UNHANDLED REJECTION:", reason)
  console.error("Promise:", promise)
})

// Запуск сервера
if (require.main === module) {
  console.log("🎬 СТАРТ ПРИЛОЖЕНИЯ")
  const server = new MafiaGameServer()
  server.start()
}

module.exports = MafiaGameServer
