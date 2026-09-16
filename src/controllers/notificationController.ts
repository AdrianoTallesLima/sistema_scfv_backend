import { prisma } from "../db.js"

export async function listNotifications(req: any, res: any) {
  try {
    const usersWithoutNis = await prisma.scfvUser.count({
      where: {
        active: true,
        nis: null
      }
    })

    const ageLimitUsers = await prisma.scfvUser.findMany({
      where: {
        deactivationType: "AGE_LIMIT",
        active: false,
        inactiveAt: {
          not: null
        }
      },

      orderBy: {
        inactiveAt: "desc"
      },

      select: {
        id: true,
        name: true,
        inactiveAt: true
      }
    })

    const notifications: any[] = []

    if (usersWithoutNis > 0) {
      notifications.push({
        type: "MISSING_NIS",
        message:
          usersWithoutNis === 1
            ? "1 usuário está sem NIS."
            : `${usersWithoutNis} usuários estão sem NIS.`,
        count: usersWithoutNis
      })
    }

    for (const user of ageLimitUsers) {
      notifications.push({
        type: "AGE_LIMIT",
        message:
          `${user.name} foi inativado automaticamente por limite de idade.`,
        userId: user.id,
        createdAt: user.inactiveAt
      })
    }

    return res.status(200).json({
      total: notifications.length,
      notifications
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: "Erro interno do servidor."
    })
  }
}