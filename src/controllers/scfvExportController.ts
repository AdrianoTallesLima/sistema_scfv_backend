import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage
} from "pdf-lib"

import {
  getFilteredScfvUsers,
  ScfvUserListValidationError
} from "../services/scfvUserListService.js"

function formatCpf(value: string) {
  if (value.length !== 11) {
    return value
  }

  return value.replace(
    /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
    "$1.$2.$3-$4"
  )
}

function formatNis(value: string | null) {
  if (!value) {
    return "-"
  }

  return value
}

function formatDate(date: Date) {
  const day = String(
    date.getUTCDate()
  ).padStart(2, "0")

  const month = String(
    date.getUTCMonth() + 1
  ).padStart(2, "0")

  const year =
    date.getUTCFullYear()

  return `${day}/${month}/${year}`
}

function formatActivity(activity: string) {
  if (activity === "SCFV_0_6") {
    return "0 a 6 anos"
  }

  if (activity === "SCFV_7_15") {
    return "7 a 15 anos"
  }

  return "Idosos"
}

function formatStatus(active: boolean) {
  return active
    ? "Ativo"
    : "Inativo"
}

function fitText(
  value: string,
  font: PDFFont,
  size: number,
  maxWidth: number
) {
  const original = value || "-"

  if (
    font.widthOfTextAtSize(
      original,
      size
    ) <= maxWidth
  ) {
    return original
  }

  let text = original

  while (
    text.length > 3 &&
    font.widthOfTextAtSize(
      `${text}...`,
      size
    ) > maxWidth
  ) {
    text = text.slice(0, -1)
  }

  return `${text}...`
}

function getMonthName(month: number) {
  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro"
  ]

  return months[month - 1]
}

function describeFilters(filters: any) {
  const parts: string[] = []

  if (filters.search) {
    parts.push(
      `Busca: ${filters.search}`
    )
  }

  if (filters.category === "CHILDREN") {
    parts.push(
      "Público: Crianças"
    )
  }

  if (filters.category === "ELDERLY") {
    parts.push(
      "Público: Idosos"
    )
  }

  if (filters.activity === "SCFV_0_6") {
    parts.push(
      "Faixa: 0 a 6 anos"
    )
  }

  if (filters.activity === "SCFV_7_15") {
    parts.push(
      "Faixa: 7 a 15 anos"
    )
  }

  if (
    filters.activity ===
    "SCFV_IDOSOS"
  ) {
    parts.push(
      "Faixa: Idosos"
    )
  }

  if (filters.active === true) {
    parts.push(
      "Situação: Ativos"
    )
  }

  if (filters.active === false) {
    parts.push(
      "Situação: Inativos"
    )
  }

  if (filters.missingNis === true) {
    parts.push(
      "NIS: Não informado"
    )
  }

  if (filters.missingNis === false) {
    parts.push(
      "NIS: Informado"
    )
  }

  if (filters.age !== null) {
    parts.push(
      `Idade: ${filters.age}`
    )
  }

  if (
    filters.birthdayMonth !== null
  ) {
    parts.push(
      `Aniversário: ${
        getMonthName(
          filters.birthdayMonth
        )
      }`
    )
  }

  if (parts.length === 0) {
    return "Filtros: Todos os usuários"
  }

  return parts.join(" | ")
}

function drawPageHeader(
  page: PDFPage,
  regularFont: PDFFont,
  boldFont: PDFFont,
  filterDescription: string,
  total: number
) {
  const width = page.getWidth()
  const height = page.getHeight()

  page.drawText(
    "Casa do Bairro - SCFV",
    {
      x: 30,
      y: height - 40,
      size: 16,
      font: boldFont
    }
  )

  page.drawText(
    "Lista de usuários",
    {
      x: 30,
      y: height - 57,
      size: 11,
      font: boldFont
    }
  )

  const generatedAt =
    new Date().toLocaleString(
      "pt-BR"
    )

  const generatedText =
    `Gerado em: ${generatedAt}`

  const generatedWidth =
    regularFont.widthOfTextAtSize(
      generatedText,
      8
    )

  page.drawText(
    generatedText,
    {
      x:
        width -
        30 -
        generatedWidth,

      y: height - 40,
      size: 8,
      font: regularFont
    }
  )

  page.drawText(
    fitText(
      filterDescription,
      regularFont,
      8,
      width - 60
    ),
    {
      x: 30,
      y: height - 78,
      size: 8,
      font: regularFont
    }
  )

  page.drawText(
    `Total de resultados: ${total}`,
    {
      x: 30,
      y: height - 94,
      size: 8,
      font: regularFont
    }
  )

  const tableTop =
    height - 120

  const headerHeight = 22

  page.drawRectangle({
    x: 30,
    y:
      tableTop -
      headerHeight,

    width:
      width - 60,

    height:
      headerHeight,

    color:
      rgb(
        0.90,
        0.92,
        0.95
      )
  })

  const columns = [
    {
      title: "Nome",
      x: 35,
      width: 225
    },
    {
      title: "CPF",
      x: 265,
      width: 90
    },
    {
      title: "NIS",
      x: 360,
      width: 85
    },
    {
      title: "Nascimento",
      x: 450,
      width: 75
    },
    {
      title: "Idade",
      x: 530,
      width: 35
    },
    {
      title: "Faixa",
      x: 570,
      width: 105
    },
    {
      title: "Situação",
      x: 680,
      width: 75
    }
  ]

  for (const column of columns) {
    page.drawText(
      column.title,
      {
        x: column.x,
        y:
          tableTop - 15,

        size: 8,
        font: boldFont
      }
    )
  }

  page.drawLine({
    start: {
      x: 30,
      y:
        tableTop -
        headerHeight
    },

    end: {
      x:
        width - 30,

      y:
        tableTop -
        headerHeight
    },

    thickness: 0.7,

    color:
      rgb(
        0.65,
        0.65,
        0.65
      )
  })

  return (
    tableTop -
    headerHeight
  )
}

export async function exportScfvUsersListPdf(
  req: any,
  res: any
) {
  try {
    const result =
      await getFilteredScfvUsers(
        req.query
      )

    const users =
      result.users

    const pdf =
      await PDFDocument.create()

    pdf.setTitle(
      "Lista de usuários - SCFV"
    )

    pdf.setAuthor(
      "Casa do Bairro"
    )

    pdf.setSubject(
      "Lista de usuários do Serviço de Convivência e Fortalecimento de Vínculos"
    )

    const regularFont =
      await pdf.embedFont(
        StandardFonts.Helvetica
      )

    const boldFont =
      await pdf.embedFont(
        StandardFonts.HelveticaBold
      )

    const pageWidth = 841.89
    const pageHeight = 595.28

    const rowHeight = 22
    const bottomMargin = 45

    const filterDescription =
      describeFilters(
        result.filters
      )

    let page =
      pdf.addPage([
        pageWidth,
        pageHeight
      ])

    let currentY =
      drawPageHeader(
        page,
        regularFont,
        boldFont,
        filterDescription,
        users.length
      )

    if (users.length === 0) {
      page.drawText(
        "Nenhum usuário encontrado para os filtros selecionados.",
        {
          x: 35,
          y:
            currentY - 30,

          size: 10,
          font: regularFont
        }
      )
    }

    for (const user of users) {
      if (
        currentY -
        rowHeight <
        bottomMargin
      ) {
        page =
          pdf.addPage([
            pageWidth,
            pageHeight
          ])

        currentY =
          drawPageHeader(
            page,
            regularFont,
            boldFont,
            filterDescription,
            users.length
          )
      }

      const textY =
        currentY - 15

      page.drawText(
        fitText(
          user.name,
          regularFont,
          8,
          220
        ),
        {
          x: 35,
          y: textY,
          size: 8,
          font: regularFont
        }
      )

      page.drawText(
        formatCpf(
          user.cpf
        ),
        {
          x: 265,
          y: textY,
          size: 8,
          font: regularFont
        }
      )

      page.drawText(
        fitText(
          formatNis(
            user.nis
          ),
          regularFont,
          8,
          82
        ),
        {
          x: 360,
          y: textY,
          size: 8,
          font: regularFont
        }
      )

      page.drawText(
        formatDate(
          user.birthDate
        ),
        {
          x: 450,
          y: textY,
          size: 8,
          font: regularFont
        }
      )

      page.drawText(
        String(user.age),
        {
          x: 530,
          y: textY,
          size: 8,
          font: regularFont
        }
      )

      page.drawText(
        fitText(
          formatActivity(
            user.activity
          ),
          regularFont,
          8,
          100
        ),
        {
          x: 570,
          y: textY,
          size: 8,
          font: regularFont
        }
      )

      page.drawText(
        formatStatus(
          user.active
        ),
        {
          x: 680,
          y: textY,
          size: 8,
          font: regularFont
        }
      )

      currentY -=
        rowHeight

      page.drawLine({
        start: {
          x: 30,
          y: currentY
        },

        end: {
          x:
            pageWidth - 30,

          y: currentY
        },

        thickness: 0.4,

        color:
          rgb(
            0.82,
            0.82,
            0.82
          )
      })
    }

    const pages =
      pdf.getPages()

    for (
      let index = 0;
      index < pages.length;
      index++
    ) {
      const currentPage =
        pages[index]

      const pageText =
        `Página ${index + 1} de ${pages.length}`

      const pageTextWidth =
        regularFont.widthOfTextAtSize(
          pageText,
          8
        )

      currentPage.drawText(
        pageText,
        {
          x:
            currentPage.getWidth() -
            30 -
            pageTextWidth,

          y: 20,
          size: 8,
          font: regularFont
        }
      )

      currentPage.drawText(
        "São Luís - MA",
        {
          x: 30,
          y: 20,
          size: 8,
          font: regularFont
        }
      )
    }

    const pdfBytes =
      await pdf.save()

    res.setHeader(
      "Content-Type",
      "application/pdf"
    )

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="lista_usuarios_scfv.pdf"'
    )

    res.setHeader(
      "Content-Length",
      String(
        pdfBytes.length
      )
    )

    return res
      .status(200)
      .end(
        Buffer.from(
          pdfBytes
        )
      )
  } catch (error) {
    if (
      error instanceof
      ScfvUserListValidationError
    ) {
      return res.status(400).json({
        message: error.message
      })
    }

    console.error(error)

    return res.status(500).json({
      message:
        "Erro ao gerar o PDF da lista de usuários."
    })
  }
}