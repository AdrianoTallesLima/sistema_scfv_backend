import { Router } from "express"
import { createScfvUser } from "../controllers/scfvUserController.js"
import { authenticate } from "../middlewares/authMiddleware.js"

const router = Router()

router.post("/", authenticate, createScfvUser)

export default router