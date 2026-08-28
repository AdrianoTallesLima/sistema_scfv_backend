import bcrypt from "bcryptjs"
import { prisma } from "../db.js"

export async function login(req: any, res: any) {
  try {
    const { login, senha } = req.body

    if (!login || !senha) {
      return res.status(400).json({
        mensagem: "Login e senha são obrigatórios."
      })
    }

    const usuario = await prisma.usuario.findUnique({
      where: {
        login
      }
    })

    if (!usuario) {
      return res.status(401).json({
        mensagem: "Login ou senha inválidos."
      })
    }

    if (!usuario.ativo) {
      return res.status(403).json({
        mensagem: "Usuário inativo."
      })
    }

    const senhaCorreta = await bcrypt.compare(
      senha,
      usuario.senhaHash
    )

    if (!senhaCorreta) {
      return res.status(401).json({
        mensagem: "Login ou senha inválidos."
      })
    }

    req.session.usuario = {
      id: usuario.id,
      nome: usuario.nome,
      login: usuario.login,
      perfil: usuario.perfil,
    }

    return res.status(200).json({
      mensagem: "Login realizado com sucesso.",
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        login: usuario.login,
        perfil: usuario.perfil
      }
    })
  } catch (erro) {
    console.error(erro)

    return res.status(500).json({
      mensagem: "Erro interno do servidor."
    })
  }
}

export async function me(req: any, res: any) {
  return res.status(200).json({
    usuario: req.session.usuario
  })
}
  

export async function logout(req: any, res: any) {
  req.session.destroy((erro: any) => {
    if (erro) {
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
