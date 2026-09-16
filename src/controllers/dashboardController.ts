import { prisma } from "../db.js"

export async function getDashboard(req: any, res: any) {
  try {
    const today = new Date()
    const currentMonth = today.getMonth() + 1
    const currentYear = today.getFullYear()

    const [
      children0To6,
      children7To15,
      elderly,
      activeUsers
    ] = await Promise.all([
      prisma.scfvUser.count({
        where: {
          active: true,
          activity: "SCFV_0_6"
        }
      }),

      prisma.scfvUser.count({
        where: {
          active: true,
          activity: "SCFV_7_15"
        }
      }),

      prisma.scfvUser.count({
        where: {
          active: true,
          activity: "SCFV_IDOSOS"
        }
      }),

      prisma.scfvUser.findMany({
        where: {
          active: true
        },

        select: {
          id: true,
          name: true,
          birthDate: true,
          activity: true
        }
      })
    ])

    const birthdays = activeUsers
      .filter((user) => {
        return (
          user.birthDate.getUTCMonth() + 1 ===
          currentMonth
        )
      })

      .map((user) => ({
        id: user.id,
        name: user.name,

        day: user.birthDate.getUTCDate(),

        ageTurning:
          currentYear -
          user.birthDate.getUTCFullYear(),

        activity: user.activity
      }))

      .sort((a, b) => {
        if (a.day !== b.day) {
          return a.day - b.day
        }

        return a.name.localeCompare(
          b.name,
          "pt-BR"
        )
      })

    const childrenTotal =
      children0To6 + children7To15

    const total =
      childrenTotal + elderly

    return res.status(200).json({
      counters: {
        children0To6,
        children7To15,
        childrenTotal,
        elderly,
        total
      },

      birthdays: {
        month: currentMonth,
        total: birthdays.length,
        users: birthdays
      }
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: "Erro interno do servidor."
    })
  }
}
