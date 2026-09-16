import { Router } from "express"
import { listNotifications } from "../controllers/notificationController.js"
import { authenticate } from "../middlewares/authMiddleware.js"

const router = Router()

router.get("/", authenticate, listNotifications)

export default router
