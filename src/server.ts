import "dotenv/config"
import express from "express"
import session from "express-session"
import connectPgSimple from "connect-pg-simple"

import authRoutes from "./routes/authRoutes.js"
import userRoutes from "./routes/userRoutes.js"
import scfvUserRoutes from "./routes/scfvUserRoutes.js"
import notificationRoutes from "./routes/notificationRoutes.js"
import { deactivateUsersByAgeLimit } from "./services/scfvAgeService.js"

const app = express()

const PgSession = connectPgSimple(session)

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET não definida no arquivo .env")
}

app.use(express.json())

app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
    }),

    secret: process.env.SESSION_SECRET,

    resave: false,
    saveUninitialized: false,

    rolling:true,

    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 30 * 60 * 1000,
    }
  })
)

async function runAgeLimitCheck() {
  try {
    const result =
      await deactivateUsersByAgeLimit()

    if (result.count > 0) {
      console.log(
        `[SCFV] ${result.count} usuário(s) inativado(s) automaticamente por limite de idade.`
      )
    }
  } catch (error) {
    console.error(
      "[SCFV] Erro ao verificar limite de idade:",
      error
    )
  }
}

app.get("/", (req, res) => {
  res.json({
    mensagem: "API do sistema SCFV funcionando!"
  })
})

app.use("/api", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/scfv-users", scfvUserRoutes)
app.use("/api/notifications", notificationRoutes)

const AGE_CHECK_INTERVAL =
  60 * 60 * 1000

app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000")

  // Verifica imediatamente ao iniciar o servidor.
  void runAgeLimitCheck()

  // Depois verifica novamente a cada hora.
  setInterval(() => {
    void runAgeLimitCheck()
  }, AGE_CHECK_INTERVAL)
})
