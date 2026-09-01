import bcrypt from "bcryptjs"
import { prisma } from "../db.js"

export async function createUser(req: any, res: any) {
  try {
    const { name, login, password } = req.body

    if (!name || !login || !password) {
      return res.status(400).json({
        message: "Nome, login e senha são obrigatórios."
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "A senha deve ter pelo menos 6 caracteres."
      })
    }

    const existingUser = await prisma.usuario.findUnique({
      where: {
        login
      }
    })

    if (existingUser) {
      return res.status(409).json({
        message: "Este login já está em uso."
      })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.usuario.create({
      data: {
        nome: name,
        login,
        senhaHash: passwordHash,
        perfil: "ORIENTADOR"
      }
    })

    return res.status(201).json ({
      message: "Usuário criado com sucesso.",
      user: {
        id: user.id,
        name: user.nome,
        login: user.login,
        role: user.perfil,
        active: user.ativo
      }
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: "Erro interno do servidor."
    })
  }
}

export async function listUsers(req: any, res: any) {
  try {
    const users = await prisma.usuario.findMany({
      select: {
        id: true,
        nome: true,
        login: true,
        perfil: true,
        ativo: true,
        criadoEm: true
      },
      orderBy: {
        nome: "asc"
      }
    })

    return res.status(200).json({
      users: users.map((user) => ({
        id: user.id,
        name: user.nome,
        login: user.login,
        role: user.perfil,
        active: user.ativo,
        createdAt: user.criadoEm
      }))
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: "Erro interno do servidor."
    })
  }
}

export async function changeUserStatus(req: any, res: any) {
  try {
    const userId = Number(req.params.id)
    const { active } = req.body

    if (Number.isNaN(userId)) {
      return res.status(400).json({
        message: "ID de usuário inválido."
      })
    }

    if (typeof active !== "boolean") {
      return res.status(400).json({
        message: "O campo active deve ser true ou false"
      })
    }

    if (userId === req.session.user.id && active === false) {
      return res.status(400).json({
        message: "Você não pode inativar sua própria conta."
      })
    }

    const existingUser = await prisma.usuario.findUnique({
      where: {
        id: userId
      }
    })

    if (!existingUser) {
      return res.status(400).json({
        message: "Usuário não encontrado."
      })
    }

    const user = await prisma.usuario.update({
      where: {
        id: userId
      },
      data: {
        ativo: active
      }
    })

    return res.status(200).json({
      message: active
        ? "Usuário ativado com sucesso."
        : "Usuário inativado com sucesso.",
      user: {
        id: user.id,
        name: user.nome,
        login: user.login,
        role: user.perfil,
        active: user.ativo
      }
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: "Erro interno do servidor"
    })    
  }
}

export async function updateUser(req: any, res: any) {
  try {
    const userId = Number(req.params.id)
    const { name, login } = req.body

    if (Number.isNaN(userId)) {
      return res.status(400).json({
        message: "ID de usuário inválido."
      })
    }

    if (!name || !login) {
      return res.status(400).json({
        message: "Nome e login são obrigatórios."
      })
    }

    const existingUser = await prisma.usuario.findUnique({
      where: {
        id: userId
      }
    })

    if (!existingUser) {
      return res.status(400).json({
        message: "Usuário não encontrado"
      })
    }

    const loginInUse = await prisma.usuario.findFirst({
      where: {
        login,
        NOT: {
          id: userId
        }
      }
    })

    if (loginInUse) {
      return res.status(409).json({
        message: "Este nome de usuário já está em uso."
      })
    }

    const user = await prisma.usuario.update({
      where: {
        id: userId
      },
      data: {
        nome: name,
        login
      }
    })

    return res.status(200).json({
      message: "Usuário atualizado com sucesso.",
      user: {
        id: user.id,
        name: user.nome,
        login: user.login,
        role: user.perfil,
        active: user.ativo
      }
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: "Erro interno do servidor."
    })
  }
}
