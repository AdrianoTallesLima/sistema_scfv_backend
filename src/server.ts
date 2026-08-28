import express from "express"
import authRoutes from "./routes/authRoutes.js"

const app = express()

app.use(express.json())

app.get("/", (req, res) => {
  res.json({
    mensagem: "API do sistema SCFV funcionando!"
  })
})

app.use("/api", authRoutes)

app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000")
})
