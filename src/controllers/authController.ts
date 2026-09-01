import bcrypt from "bcryptjs"
import { prisma } from "../db.js"

export async function login(req: any, res: any) {
  try {
    const { login, password } = req.body

    if (!login || !password) {
      return res.status(400).json({
        mensagem: "Login e senha são obrigatórios."
      })
    }

    const user = await prisma.usuario.findUnique({
      where: {
        login
      }
    })

    if (!user) {
      return res.status(401).json({
        mensagem: "Login ou senha inválidos."
      })
    }

    if (!user.ativo) {
      return res.status(403).json({
        mensagem: "Usuário inativo."
      })
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.senhaHash
    )

    if (!isPasswordCorrect) {
      return res.status(401).json({
        mensagem: "Login ou senha inválidos."
      })
    }

    req.session.user = {
      id: user.id,
      name: user.nome,
      login: user.login,
      role: user.perfil
    }

    return res.status(200).json({
      mensagem: "Login realizado com sucesso.",
      user: {
        id: user.id,
        name: user.nome,
        login: user.login,
        role: user.perfil
      }
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      mensagem: "Erro interno do servidor."
    })
  }
}

export async function me(req: any, res: any) {
  return res.status(200).json({
    user: req.session.user
  })
}

export async function logout(req: any, res: any) {
  req.session.destroy((error: any) => {
    if (error) {
      return res.status(500).json({
        mensagem: "Erro ao encerrar sessão."
      })
    }

    res.clearCookie("connect.sid")

    return res.status(200).json({
      mensagem: "Logout realizado com sucesso."
    })
  })
}