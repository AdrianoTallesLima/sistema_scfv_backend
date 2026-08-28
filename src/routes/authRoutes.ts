import { Router } from "express"
import { login, me, logout } from "../controllers/authController.js"
import { autenticar } from "../middlewares/authMiddleware.js"

const router = Router()

router.post("/login", login)
router.get("/me", autenticar, me)
router.post("/logout", logout)

export default router
