import "dotenv/config"
import express from "express"
import session from "express-session"
import connectPgSimple from "connect-pg-simple"

import authRoutes from "./routes/authRoutes.js"
import userRoutes from "./routes/userRoutes.js"

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

app.get("/", (req, res) => {
  res.json({
    mensagem: "API do sistema SCFV funcionando!"
  })
})

app.use("/api", authRoutes)
app.use("/api/users", userRoutes)

app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000")
})
