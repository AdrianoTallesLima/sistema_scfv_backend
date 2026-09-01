import "dotenv/config"
import bcrypt from "bcryptjs"
import { prisma } from "../src/db.js"

async function createAdmin() {
  const name = process.env.ADMIN_NAME
  const login = process.env.ADMIN_LOGIN
  const password = process.env.ADMIN_PASSWORD

  if (!name || !login || !password) {
    throw new Error("Dados do administrador não encontrados no .env")
  }

  const existingUser = await prisma.usuario.findUnique({
    where: {
      login
    }
  })

  if (existingUser) {
    console.log("Já existe um usuário com esse login.")
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const admin = await prisma.usuario.create({
    data: {
      nome: name,
      login,
      senhaHash: passwordHash,
      perfil: "ADMIN"
    }
  })

  console.log(`Administrador "${admin.nome}" criado com sucesso!`)
}

createAdmin()
  .catch((error) => {
    console.error(error)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
  