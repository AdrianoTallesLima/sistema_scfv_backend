export function autenticar(req: any, res: any, next: any) {
  if (!req.session.usuario) {
    return res.status(401).json({
      mensagem: "Usuário não autenticado."
    })
  }
  next()
}