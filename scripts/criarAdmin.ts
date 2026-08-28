import "dotenv/config"
import bcrypt from "bcryptjs"
import { prisma } from "../src/db.js"

async function criarAdmin() {
  const nome = process.env.ADMIN_NOME
  const login = process.env.ADMIN_LOGIN
  const senha = process.env.ADMIN_SENHA

  if (!nome || !login || !senha) {
    throw new Error("Dados do administrador não encontrados no .env")
  }

  const usuarioExistente = await prisma.usuario.findUnique({
    where: {
      login
    }
  })

  if (usuarioExistente) {
    console.log("Já existe um usuário com esse login.")
    return
  }

  const senhaHash = await bcrypt.hash(senha, 12)

  const admin = await prisma.usuario.create({
    data: {
      nome,
      login,
      senhaHash,
      perfil: "ADMIN"
    }
  })

  console.log(`Administrador "${admin.nome}" criado com sucesso!`)
}

criarAdmin()
  .catch((erro) => {
    console.error(erro)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
  