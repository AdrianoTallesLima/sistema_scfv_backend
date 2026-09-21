import multer from "multer"
import path from "node:path"
import fs from "node:fs"
import crypto from "node:crypto"

const uploadDirectory = path.resolve(
  process.cwd(),
  "uploads",
  "scfv-users"
)

fs.mkdirSync(uploadDirectory, {
  recursive: true
})

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp"
]

const extensionByMimeType: Record<
  string,
  string
> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
}

async function detectImageMimeType(
  filePath: string
) {
  const file = await fs.promises.open(
    filePath,
    "r"
  )

  try {
    const buffer = Buffer.alloc(12)

    await file.read(
      buffer,
      0,
      12,
      0
    )

    // PNG
    const pngSignature = Buffer.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a
    ])

    if (
      buffer
        .subarray(0, 8)
        .equals(pngSignature)
    ) {
      return "image/png"
    }

    // JPEG
    if (
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return "image/jpeg"
    }

    // WEBP
    const isWebp =
      buffer
        .subarray(0, 4)
        .toString("ascii") === "RIFF" &&
      buffer
        .subarray(8, 12)
        .toString("ascii") === "WEBP"

    if (isWebp) {
      return "image/webp"
    }

    return null
  } finally {
    await file.close()
  }
}

const storage = multer.diskStorage({
  destination: (
    req,
    file,
    callback
  ) => {
    callback(
      null,
      uploadDirectory
    )
  },

  filename: (
    req,
    file,
    callback
  ) => {
    const extension =
      extensionByMimeType[
        file.mimetype
      ]

    const filename =
      `${crypto.randomUUID()}${extension}`

    callback(
      null,
      filename
    )
  }
})

const uploadScfvPhoto = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: (
    req,
    file,
    callback
  ) => {
    if (
      !allowedMimeTypes.includes(
        file.mimetype
      )
    ) {
      return callback(
        new Error(
          "Formato de imagem inválido. Utilize JPG, PNG ou WEBP."
        )
      )
    }

    callback(
      null,
      true
    )
  }
})

export function handleScfvPhotoUpload(
  req: any,
  res: any,
  next: any
) {
  uploadScfvPhoto.single("photo")(
    req,
    res,

    async (error: any) => {
      if (error) {
        if (
          error instanceof
          multer.MulterError
        ) {
          if (
            error.code ===
            "LIMIT_FILE_SIZE"
          ) {
            return res
              .status(400)
              .json({
                message:
                  "A foto deve possuir no máximo 5 MB."
              })
          }

          if (
            error.code ===
            "LIMIT_UNEXPECTED_FILE"
          ) {
            return res
              .status(400)
              .json({
                message:
                  "Campo de arquivo inválido."
              })
          }

          return res
            .status(400)
            .json({
              message:
                "Não foi possível enviar a foto."
            })
        }

        if (
          error instanceof Error
        ) {
          return res
            .status(400)
            .json({
              message:
                error.message
            })
        }

        return res
          .status(400)
          .json({
            message:
              "Não foi possível enviar a foto."
          })
      }

      // Nenhum arquivo enviado:
      // o controller tratará esse caso.
      if (!req.file) {
        return next()
      }

      try {
        const detectedMimeType =
          await detectImageMimeType(
            req.file.path
          )

        /*
         * Além de ser uma imagem válida,
         * o conteúdo real precisa coincidir
         * com o tipo declarado no upload.
         */
        if (
          !detectedMimeType ||
          detectedMimeType !==
            req.file.mimetype
        ) {
          await fs.promises
            .unlink(req.file.path)
            .catch(() => {})

          req.file = undefined

          return res
            .status(400)
            .json({
              message:
                "O arquivo enviado não contém uma imagem JPG, PNG ou WEBP válida."
            })
        }

        return next()
      } catch (validationError) {
        console.error(
          "[SCFV] Erro ao validar conteúdo da foto:",
          validationError
        )

        if (req.file?.path) {
          await fs.promises
            .unlink(req.file.path)
            .catch(() => {})
        }

        req.file = undefined

        return res
          .status(500)
          .json({
            message:
              "Erro ao validar a foto enviada."
          })
      }
    }
  )
}