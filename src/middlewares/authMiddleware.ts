import { prisma } from "../db.js"

export async function authenticate(req: any, res: any, next: any) {
  try {
    const sessionUser = req.session.user

    if (!sessionUser) {
      return res.status(401).json({
        mensagem: "Usuário não autenticado."
      })
    }

    const user = await prisma.usuario.findUnique({
      where: {
        id: sessionUser.id
      },
      select: {
        id: true,
        nome: true,
        login: true,
        perfil: true,
        ativo: true
      }
    })

    if (!user || !user.ativo) {
      req.session.destroy(() => {})

      res.clearCookie("connect.sid")

      return res.status(401).json({
        mensagem: "Usuário não autenticado ou inativo."
      })
    }

    req.session.user = {
      id: user.id,
      name: user.nome,
      login: user.login,
      role: user.perfil
    }

    next()
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      mensagem: "Erro interno do servidor."
    })
  }
}

export function adminOnly(req: any, res: any, next: any) {
  if (req.session.user.role !== "ADMIN") {
    return res.status(403).json({
      mensagem: "Acesso permitido somente para administradores."
    })
  }

  next()
}
