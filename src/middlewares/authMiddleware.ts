export function authenticate(req: any, res: any, next: any) {
  if (!req.session.user) {
    return res.status(401).json({
      mensagem: "Usuário não autenticado."
    })
  }

  next()
}

export function adminOnly(req: any, res: any, next: any) {
  if (req.session.user.role !== "ADMIN") {
    return res.status(403).json({
      mensagem: "Acesso permitido somente para administradores."
    })
  }

  next()
}